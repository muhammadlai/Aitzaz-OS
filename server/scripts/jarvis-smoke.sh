#!/bin/bash
cd "$(dirname "$0")/.."
say -o /tmp/aitzaz_smoke.wav --data-format=LEI16@16000 "Say only the word confirmed." 2>/dev/null
.venv/bin/python scripts/ws_e2e_test.py /tmp/aitzaz_smoke.wav aitzaz-debug
