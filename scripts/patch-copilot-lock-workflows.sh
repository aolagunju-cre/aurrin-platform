#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

ruby - "$ROOT_DIR" "$@" <<'RUBY'
require "pathname"

root_dir = ARGV.shift

workflow_paths =
  if ARGV.empty?
    Dir[File.join(root_dir, ".github/workflows/*.lock.yml")].select do |path|
      content = File.read(path)
      content.include?("id: agentic_execution") && content.include?("install_copilot_cli.sh latest")
    end
  else
    ARGV.map { |path| File.expand_path(path, root_dir) }
  end

if workflow_paths.empty?
  warn "No Copilot lock workflows found to patch."
  exit 0
end

def patch_step!(content, step_id:, log_path:, output_path: nil)
  pattern = /(?<prefix>^      - name: Execute GitHub Copilot CLI\n(?:        if:.*\n)?        id: #{Regexp.escape(step_id)}\n)(?<body>.*?)(?=^        env:\n)/m
  match = pattern.match(content)
  raise "Could not find step #{step_id}" unless match

  body = match[:body]

  unless body.include?("        continue-on-error: true\n")
    old_line = "        # Copilot CLI tool arguments (sorted):\n"
    new_line = "        continue-on-error: true\n#{old_line}"
    raise "Could not add continue-on-error for #{step_id}" unless body.sub!(old_line, new_line)
  end

  wrapper_prefix =
    if output_path
      [
        "          GH_AW_COPILOT_LOG_PATH=#{log_path} \\",
        "          GH_AW_COPILOT_OUTPUT_PATH=#{output_path} \\",
        "          bash scripts/run-copilot-with-retry.sh \\",
        "            sudo -E awf"
      ].join("\n")
    else
      [
        "          GH_AW_COPILOT_LOG_PATH=#{log_path} \\",
        "          bash scripts/run-copilot-with-retry.sh \\",
        "            sudo -E awf"
      ].join("\n")
    end

  unless body.include?("bash scripts/run-copilot-with-retry.sh")
    command_prefix = "          # shellcheck disable=SC1003\n          sudo -E awf"
    replacement = "          # shellcheck disable=SC1003\n#{wrapper_prefix}"
    raise "Could not wrap Copilot command for #{step_id}" unless body.sub!(command_prefix, replacement)
  end

  tee_suffix = " 2>&1 | tee -a #{log_path}"
  body.sub!(tee_suffix, "")

  content.sub!(match[0], "#{match[:prefix]}#{body}")
end

def ensure_substitution!(content, from, to, label)
  return if content.include?(to)
  raise "Could not patch #{label}" unless content.sub!(from, to)
end

def replace_detection_section!(content, baseline_content)
  pattern = /^      - name: Execute GitHub Copilot CLI\n        if: always\(\) && steps\.detection_guard\.outputs\.run_detection == 'true'\n        id: detection_agentic_execution\n.*?(?=^  conclusion:\n)/m
  baseline_match = pattern.match(baseline_content)
  current_match = pattern.match(content)
  raise "Could not find baseline detection section" unless baseline_match
  raise "Could not find current detection section" unless current_match

  baseline_section = baseline_match[0].dup

  unless baseline_section.include?("        continue-on-error: true\n")
    old_line = "        # Copilot CLI tool arguments (sorted):\n"
    new_line = "        continue-on-error: true\n#{old_line}"
    raise "Could not add continue-on-error to detection section" unless baseline_section.sub!(old_line, new_line)
  end

  content[current_match.begin(0)...current_match.end(0)] = baseline_section
end

status_steps = <<'YAML'
      - name: Note tolerated Copilot CLI failure
        if: always() && steps.agentic_execution.outputs.tolerated_failure == 'true'
        run: |
          echo "::warning title=GitHub Copilot failure tolerated::Copilot exited ${{ steps.agentic_execution.outputs.exit_code }} after ${{ steps.agentic_execution.outputs.attempts }} attempt(s) but produced /tmp/gh-aw/agent_output.json, so the workflow is continuing."
      - name: Fail for upstream Copilot transient error without agent output
        if: always() && steps.agentic_execution.outputs.output_present != 'true' && steps.agentic_execution.outputs.transient_error_detected == 'true'
        run: |
          echo "::error title=Upstream Copilot transient failure::GitHub Copilot CLI exhausted retries without producing /tmp/gh-aw/agent_output.json."
          exit 1
      - name: Fail for Copilot CLI missing agent output
        if: always() && steps.agentic_execution.outputs.output_present != 'true' && steps.agentic_execution.outputs.transient_error_detected != 'true'
        run: |
          echo "::error title=Copilot CLI missing agent output::GitHub Copilot CLI exited without producing /tmp/gh-aw/agent_output.json."
          exit 1
YAML

workflow_paths.each do |path|
  content = File.read(path)
  original = content.dup

  baseline_content = content
  if File.expand_path(path).start_with?("#{root_dir}/")
    rel_path = Pathname.new(path).relative_path_from(Pathname.new(root_dir)).to_s
    git_show = IO.popen(["git", "-C", root_dir, "show", "HEAD:#{rel_path}"], &:read)
    baseline_content = git_show if $?.success?
  end

  content.gsub!(/^(\s+GH_AW_WORKFLOW_ID:)\s*\n(".*")$/, '\1 \2')

  patch_step!(
    content,
    step_id: "agentic_execution",
    log_path: "/tmp/gh-aw/agent-stdio.log",
    output_path: "/tmp/gh-aw/agent_output.json"
  )

  replace_detection_section!(content, baseline_content)

  agent_outputs_from = "      output_types: ${{ steps.collect_output.outputs.output_types }}\n"
  agent_outputs_to = <<'TEXT'
      output_types: ${{ steps.collect_output.outputs.output_types }}
      agent_execution_status: ${{ steps.agentic_execution.outputs.output_present == 'true' && 'success' || 'failure' }}
      copilot_tolerated_failure: ${{ steps.agentic_execution.outputs.tolerated_failure || 'false' }}
      copilot_transient_error: ${{ steps.agentic_execution.outputs.transient_error_detected || 'false' }}
TEXT
  ensure_substitution!(content, agent_outputs_from, agent_outputs_to, "#{File.basename(path)} outputs")

  collect_output_from = "      - name: Ingest agent output\n        id: collect_output\n        if: always()\n"
  collect_output_to = "      - name: Ingest agent output\n        id: collect_output\n        if: always() && steps.agentic_execution.outputs.output_present == 'true'\n"
  ensure_substitution!(content, collect_output_from, collect_output_to, "#{File.basename(path)} collect_output guard")

  unless content.include?("      - name: Note tolerated Copilot CLI failure\n")
    anchor = "      - name: Print firewall logs\n"
    ensure_substitution!(content, anchor, "#{status_steps}#{anchor}", "#{File.basename(path)} status steps")
  end

  failure_env_pattern = /          GH_AW_AGENT_CONCLUSION: \$\{\{ needs\.agent\.result \}\}\n          GH_AW_WORKFLOW_ID: (?<value>".*")\n/
  unless content.include?("          GH_AW_AGENT_EXECUTION_STATUS: ${{ needs.agent.outputs.agent_execution_status }}\n")
    content.sub!(failure_env_pattern) do
      [
        "          GH_AW_AGENT_CONCLUSION: ${{ needs.agent.result }}",
        "          GH_AW_AGENT_EXECUTION_STATUS: ${{ needs.agent.outputs.agent_execution_status }}",
        "          GH_AW_COPILOT_TOLERATED_FAILURE: ${{ needs.agent.outputs.copilot_tolerated_failure }}",
        "          GH_AW_COPILOT_TRANSIENT_ERROR: ${{ needs.agent.outputs.copilot_transient_error }}",
        "          GH_AW_WORKFLOW_ID: #{Regexp.last_match[:value]}"
      ].join("\n") + "\n"
    end
  end

  comment_env_from = "          GH_AW_AGENT_CONCLUSION: ${{ needs.agent.result }}\n          GH_AW_DETECTION_CONCLUSION: ${{ needs.agent.outputs.detection_conclusion }}\n"
  comment_env_to = <<'TEXT'
          GH_AW_AGENT_CONCLUSION: ${{ needs.agent.result }}
          GH_AW_AGENT_EXECUTION_STATUS: ${{ needs.agent.outputs.agent_execution_status }}
          GH_AW_COPILOT_TOLERATED_FAILURE: ${{ needs.agent.outputs.copilot_tolerated_failure }}
          GH_AW_COPILOT_TRANSIENT_ERROR: ${{ needs.agent.outputs.copilot_transient_error }}
          GH_AW_DETECTION_CONCLUSION: ${{ needs.agent.outputs.detection_conclusion }}
TEXT
  content.sub!(comment_env_from, comment_env_to)

  File.write(path, content) if content != original
end

puts "Patched #{workflow_paths.length} Copilot lock workflow(s)"
workflow_paths.each { |path| puts "- #{path}" }
RUBY
