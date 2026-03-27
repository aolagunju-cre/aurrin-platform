#!/usr/bin/env bash
set -euo pipefail

INPUT_JSON=$(cat)
export INPUT_JSON

ruby <<'RUBY'
require 'json'

input = ENV.fetch('INPUT_JSON', '')
issues = input.strip.empty? ? [] : JSON.parse(input)

PROVIDER_KEYWORDS = %w[
  generation asset assets storage outbox schema contract contracts migration
  handler handlers api apis service services queue queued job jobs worker workers
  auth session sessions utility utilities slug data foundation foundational
  infrastructure reusable helper helpers provider providers render renderer
].freeze

CONSUMER_KEYWORDS = %w[
  page pages ui directory profile profiles public docs documentation e2e
  integration integrations test tests workflow workflows share sharing button
  buttons portal dashboard dashboards email emails notification notifications
  search filters filter highlight highlights
].freeze

def extract_dependencies(body)
  text = body.to_s
  source =
    if text =~ /^\s*##\s+Dependencies\s*\n(.*?)(?=^\s*##\s+|\z)/mi
      Regexp.last_match(1)
    else
      text.scan(/^.*\bDepends on\b.*$/i).join("\n")
    end

  seen = {}
  ordered = []
  emit = lambda do |number|
    value = number.to_i
    return if value <= 0 || seen[value]

    seen[value] = true
    ordered << value
  end

  source.scan(/#(\d+)\s*(?:through|to|-|–|—)\s*#?(\d+)/i) do |start_value, finish_value|
    start_number = start_value.to_i
    finish_number = finish_value.to_i
    start_number, finish_number = finish_number, start_number if start_number > finish_number
    (start_number..finish_number).each { |number| emit.call(number) }
  end

  source.scan(/#(\d+)\b/) { |number| emit.call(number.first) }
  ordered
end

def keyword_score(text, keywords, weight)
  lowered = text.to_s.downcase
  keywords.sum { |keyword| lowered.include?(keyword) ? weight : 0 }
end

def issue_profile(issue)
  title = issue['title'].to_s
  body = issue['body'].to_s

  provider_score = keyword_score(title, PROVIDER_KEYWORDS, 3) + keyword_score(body, PROVIDER_KEYWORDS, 1)
  consumer_score = keyword_score(title, CONSUMER_KEYWORDS, 3) + keyword_score(body, CONSUMER_KEYWORDS, 1)

  {
    provider_score: provider_score,
    consumer_score: consumer_score,
    bias: provider_score - consumer_score
  }
end

def canonical_cycle(nodes)
  sequences = []
  [nodes, nodes.reverse].each do |variant|
    variant.length.times { |index| sequences << variant.rotate(index) }
  end
  sequences.min
end

issue_map = {}
open_numbers = {}

issues.each do |issue|
  number = issue.fetch('number').to_i
  issue_map[number] = issue
  open_numbers[number] = true
end

graph = {}
issue_map.each do |number, issue|
  graph[number] = extract_dependencies(issue['body']).select { |dependency| open_numbers[dependency] }
end

cycles = {}
visited = {}
stack = []
stack_index = {}

dfs = lambda do |node|
  visited[node] = true
  stack_index[node] = stack.length
  stack << node

  graph.fetch(node, []).each do |dependency|
    if !visited[dependency]
      dfs.call(dependency)
    elsif stack_index.key?(dependency)
      nodes = stack[stack_index[dependency]..]
      next if nodes.nil? || nodes.empty?

      canonical = canonical_cycle(nodes)
      cycles[canonical.join('->')] ||= canonical
    end
  end

  stack.pop
  stack_index.delete(node)
end

issue_map.keys.sort.each do |number|
  dfs.call(number) unless visited[number]
end

fixes = []
unresolved = []

cycles.values.sort_by(&:first).each do |nodes|
  unless nodes.length == 2
    unresolved << {
      issues: nodes,
      reason: 'cycle_length_not_supported'
    }
    next
  end

  first, second = nodes
  first_issue = issue_map[first]
  second_issue = issue_map[second]

  first_profile = issue_profile(first_issue)
  second_profile = issue_profile(second_issue)

  first_depends_on_second = graph.fetch(first, []).include?(second)
  second_depends_on_first = graph.fetch(second, []).include?(first)

  unless first_depends_on_second && second_depends_on_first
    unresolved << {
      issues: nodes,
      reason: 'cycle_is_not_direct_mutual_dependency'
    }
    next
  end

  first_bias = first_profile[:bias]
  second_bias = second_profile[:bias]

  remove_from = nil
  remove_to = nil
  rationale = nil

  if first_bias >= 3 && second_bias <= -1
    remove_from = first
    remove_to = second
    rationale = "issue ##{first} looks foundational/provider-oriented while issue ##{second} looks consumer/UI/docs-oriented"
  elsif second_bias >= 3 && first_bias <= -1
    remove_from = second
    remove_to = first
    rationale = "issue ##{second} looks foundational/provider-oriented while issue ##{first} looks consumer/UI/docs-oriented"
  else
    unresolved << {
      issues: nodes,
      reason: 'confidence_too_low_for_auto_fix',
      first_bias: first_bias,
      second_bias: second_bias
    }
    next
  end

  fixes << {
    issues: nodes,
    remove_dependency_from: remove_from,
    remove_dependency_to: remove_to,
    rationale: rationale,
    first_bias: first_bias,
    second_bias: second_bias
  }
end

puts JSON.generate({
  fixes: fixes,
  unresolved: unresolved
})
RUBY
