#!/usr/bin/env bash
# Fast "is this checkout healthy?" check: install gems, run both check scripts, build the site.
# Same checks the deploy workflow runs. Needs Ruby (see .github/workflows/pages.yml) and Python 3.
set -euo pipefail
cd "$(dirname "$0")"
bundle install --quiet
python3 scripts/check_people.py
python3 scripts/check_i18n.py
python3 scripts/check_pdfs.py
JEKYLL_ENV=production bundle exec jekyll build --baseurl ""
