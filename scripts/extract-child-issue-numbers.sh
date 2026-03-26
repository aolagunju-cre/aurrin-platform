#!/usr/bin/env bash
set -euo pipefail

perl -ne '
  use strict;
  use warnings;

  my %seen;
  if (/^\|\s*#([0-9]+)\s*\|/) {
    next if $seen{$1}++;
    print "$1\n";
  }
'
