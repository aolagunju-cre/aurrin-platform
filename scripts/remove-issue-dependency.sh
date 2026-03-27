#!/usr/bin/env bash
set -euo pipefail

TARGET_ISSUE="${1:?target issue number required}"
INPUT_BODY=$(cat)
export TARGET_ISSUE INPUT_BODY

ruby <<'RUBY'
require 'json'

target_issue = ENV.fetch('TARGET_ISSUE')
body = ENV.fetch('INPUT_BODY', '')

section_pattern = /^\s*##\s+Dependencies\s*\n(.*?)(?=^\s*##\s+|\z)/mi
match = body.match(section_pattern)

unless match
  puts JSON.generate({ changed: false, body: body })
  exit 0
end

dependencies_section = match[1]
updated_section = dependencies_section.dup

target_pattern = /##{Regexp.escape(target_issue)}\b(?:\s*\([^)\n]*\))?/i
line_changed = false

updated_lines = updated_section.lines.map do |line|
  original = line.dup
  next line unless line.match?(target_pattern)

  line.gsub!(/,\s*#{target_pattern}/i, '')
  line.gsub!(/#{target_pattern}\s*,\s*/i, '')
  line.gsub!(/#{target_pattern}/i, '')
  line.gsub!(/\(\s*\)/, '')
  line.gsub!(/\s+,/, ',')
  line.gsub!(/,\s*,/, ', ')
  line.gsub!(/,\s*\./, '.')
  line.gsub!(/,\s*$/, '')
  line.gsub!(/Depends on\s*\.\s*$/i, 'Depends on None.')
  line.gsub!(/Depends on\s*$/i, 'Depends on None.')
  line.gsub!(/Depends on\s*\n$/i, "Depends on None.\n")
  line.gsub!(/\s{2,}/, ' ')
  line.gsub!(/\s+\./, '.')
  line.gsub!(/\s+\)/, ')')

  line_changed ||= line != original
  line
end

unless line_changed
  puts JSON.generate({ changed: false, body: body })
  exit 0
end

updated_section = updated_lines.join
updated_body = body.sub(section_pattern) { |section| section.sub(dependencies_section, updated_section) }

puts JSON.generate({
  changed: true,
  body: updated_body
})
RUBY
