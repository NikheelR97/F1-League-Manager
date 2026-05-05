#!/usr/bin/env bash
set -u

REQUIRED_NODE_MAJOR=18
REQUIRED_NODE_MINOR=18
RECOMMENDED_NODE_MAJOR=20
STRICT=0
FAILURES=()
WARNINGS=()

if [[ "${1:-}" == "--strict" ]]; then
  STRICT=1
fi

print_header() {
  printf "\n== %s ==\n" "$1"
}

add_failure() {
  FAILURES+=("$1")
  printf "FAIL %s\n" "$1"
}

add_warning() {
  WARNINGS+=("$1")
  printf "WARN %s\n" "$1"
}

add_pass() {
  printf "PASS %s\n" "$1"
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

command_text() {
  local command_name="$1"
  shift

  "$command_name" "$@" 2>/dev/null | head -n 1 | tr -d '\r'
}

version_major() {
  printf "%s" "$1" | sed 's/^v//' | cut -d. -f1
}

version_minor() {
  printf "%s" "$1" | sed 's/^v//' | cut -d. -f2
}

test_required_tool() {
  local name="$1"
  local install_hint="$2"

  if ! has_command "$name"; then
    add_failure "$name is missing. $install_hint"
    return
  fi

  local version_text
  version_text="$(command_text "$name" --version || true)"
  if [[ -z "$version_text" ]]; then
    add_pass "$name is installed."
    return
  fi

  add_pass "$name $version_text"
}

test_optional_tool() {
  local name="$1"
  local install_hint="$2"

  if ! has_command "$name"; then
    add_warning "$name is missing. $install_hint"
    return
  fi

  local version_text
  version_text="$(command_text "$name" --version || true)"
  if [[ -z "$version_text" ]]; then
    add_pass "$name is installed."
    return
  fi

  add_pass "$name $version_text"
}

test_node_version() {
  if ! has_command node; then
    return
  fi

  local version_text major minor
  version_text="$(command_text node --version || true)"
  major="$(version_major "$version_text")"
  minor="$(version_minor "$version_text")"

  if [[ -z "$major" || -z "$minor" ]]; then
    add_failure "Node.js is installed, but its version could not be read."
    return
  fi

  if (( major < REQUIRED_NODE_MAJOR )); then
    add_failure "Node.js $version_text is too old. Install Node.js $REQUIRED_NODE_MAJOR.$REQUIRED_NODE_MINOR or newer."
    return
  fi

  if (( major == REQUIRED_NODE_MAJOR && minor < REQUIRED_NODE_MINOR )); then
    add_failure "Node.js $version_text is too old. Install Node.js $REQUIRED_NODE_MAJOR.$REQUIRED_NODE_MINOR or newer."
    return
  fi

  if (( major < RECOMMENDED_NODE_MAJOR )); then
    add_warning "Node.js $version_text works, but Node.js $RECOMMENDED_NODE_MAJOR LTS is recommended."
    return
  fi

  add_pass "Node.js $version_text"
}

test_project_files() {
  if [[ -f package.json ]]; then
    add_pass "package.json found."
  else
    add_warning "package.json not found yet. This is expected before S0 scaffolding."
  fi

  if [[ -f .env.local ]]; then
    add_pass ".env.local found."
  else
    add_warning ".env.local not found. Create it after .env.example exists."
  fi

  if [[ -f .env ]]; then
    add_warning ".env found. Prefer .env.local for local secrets in Next.js projects."
  fi

  if [[ -d node_modules ]]; then
    add_pass "node_modules found."
  elif [[ -f package.json ]]; then
    add_warning "node_modules not found. Run npm install."
  fi
}

test_project_scripts() {
  if [[ ! -f package.json ]]; then
    return
  fi

  local scripts=(
    "dev"
    "build"
    "lint"
    "type-check"
    "test"
    "test:coverage"
    "test:e2e"
    "sprint-verify"
    "deploy:check"
  )

  for script_name in "${scripts[@]}"; do
    if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$script_name'] ? 0 : 1)" >/dev/null 2>&1; then
      add_pass "npm script '$script_name' exists."
    else
      add_warning "npm script '$script_name' is missing."
    fi
  done
}

printf "F1 League Manager developer machine check\n"
printf "Run with --strict to fail on warnings too.\n"

print_header "Required Tools"
test_required_tool "git" "Install Git from your package manager."
test_required_tool "node" "Install Node.js LTS from https://nodejs.org/ or nvm."
test_node_version
test_required_tool "npm" "npm should be installed with Node.js."

print_header "Recommended Tools"
test_optional_tool "gh" "Install GitHub CLI if you want easy repo auth: https://cli.github.com/"
test_optional_tool "vercel" "Install later with: npm install -g vercel"
test_optional_tool "supabase" "Install later with: npm install -g supabase"
test_optional_tool "docker" "Install Docker if you want local Supabase."

print_header "Project Files"
test_project_files
test_project_scripts

print_header "Playwright"
if [[ -f package.json ]]; then
  playwright_version="$(npx playwright --version 2>/dev/null | head -n 1 || true)"
  if [[ -z "$playwright_version" ]]; then
    add_warning "Playwright is not available yet. Run npm install after S0 setup."
  else
    add_pass "$playwright_version"
    add_warning "If E2E tests fail because browsers are missing, run: npx playwright install"
  fi
else
  add_warning "Playwright check skipped because package.json does not exist yet."
fi

print_header "Summary"
printf "Failures: %s\n" "${#FAILURES[@]}"
printf "Warnings: %s\n" "${#WARNINGS[@]}"

if (( ${#FAILURES[@]} > 0 )); then
  printf "\nFix failures before starting development:\n"
  for failure in "${FAILURES[@]}"; do
    printf -- "- %s\n" "$failure"
  done
  exit 1
fi

if (( STRICT == 1 && ${#WARNINGS[@]} > 0 )); then
  printf "\nStrict mode treats warnings as failures:\n"
  for warning in "${WARNINGS[@]}"; do
    printf -- "- %s\n" "$warning"
  done
  exit 1
fi

printf "\nDeveloper machine check passed.\n"
