#!/usr/bin/env bash
set -euo pipefail

INPUT_JSON=$(cat)
export INPUT_JSON

ruby <<'RUBY'
require 'json'

input = ENV.fetch('INPUT_JSON', '')
issues = input.strip.empty? ? [] : JSON.parse(input)

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

canonical_cycle = lambda do |nodes|
  sequences = []
  [nodes, nodes.reverse].each do |variant|
    variant.length.times { |index| sequences << variant.rotate(index) }
  end
  sequences.min
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

      canonical = canonical_cycle.call(nodes)
      cycles[canonical.join('->')] ||= canonical
    end
  end

  stack.pop
  stack_index.delete(node)
end

issue_map.keys.sort.each do |number|
  dfs.call(number) unless visited[number]
end

cycle_rows = cycles.values.sort_by(&:first).map do |nodes|
  {
    issues: nodes,
    titles: nodes.map { |number| issue_map.dig(number, 'title') }
  }
end

issue_numbers = cycle_rows.flat_map { |row| row[:issues] }.uniq.sort

puts JSON.generate({
  cycles: cycle_rows,
  issue_numbers: issue_numbers
})
RUBY
