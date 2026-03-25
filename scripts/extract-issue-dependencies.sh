#!/usr/bin/env bash
set -euo pipefail

perl -0ne '
  use strict;
  use warnings;

  my $text = $_ // q{};
  my $source = q{};

  if ($text =~ /(?ims)^\s*##\s+Dependencies\s*\n(.*?)(?=^\s*##\s+|\z)/) {
    $source = $1;
  } else {
    my @depends_on_lines = ($text =~ /(?im)^.*\bDepends on\b.*$/g);
    $source = join("\n", @depends_on_lines);
  }

  my %seen;
  while ($source =~ /#([0-9]+)\b/g) {
    next if $seen{$1}++;
    print "$1\n";
  }
'
