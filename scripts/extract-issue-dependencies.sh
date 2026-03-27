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
  my @ordered;
  my $emit = sub {
    my ($number) = @_;
    return if !defined $number || $seen{$number}++;
    push @ordered, $number;
  };

  while ($source =~ /#([0-9]+)\s*(?:through|to|-|–|—)\s*#?([0-9]+)/gi) {
    my ($start, $finish) = ($1, $2);
    ($start, $finish) = ($finish, $start) if $start > $finish;
    for my $number ($start .. $finish) {
      $emit->($number);
    }
  }

  while ($source =~ /#([0-9]+)\b/g) {
    $emit->($1);
  }

  if (@ordered) {
    print join("\n", @ordered), "\n";
  }
'
