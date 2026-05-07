#!/usr/bin/env bash
set -u

REQUIRED_NODE_MAJOR=20
REQUIRED_NODE_MINOR=9
RECOMMENDED_NODE_MAJOR=20
STRICT=0
INSTALL=0
INSTALL_PROJECT_DEPS=0
INSTALL_PLAYWRIGHT=0
FAILURES=()
WARNINGS=()

for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --install) INSTALL=1 ;;
    --install-project-deps) INSTALL_PROJECT_DEPS=1 ;;
    --install-playwright) INSTALL_PLAYWRIGHT=1 ;;
    *)
      printf "Unknown argument: %s\n" "$arg"
      exit 2
      ;;
  esac
done

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

add_info() {
  printf "INFO %s\n" "$1"
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

run_install() {
  add_info "$*"
  "$@"
}

sudo_prefix() {
  if [[ "$(id -u)" -eq 0 ]]; then
    printf ""
    return
  fi

  if has_command sudo; then
    printf "sudo"
    return
  fi

  printf ""
}

install_system_package() {
  local tool_name="$1"
  local apt_package="$2"
  local dnf_package="$3"
  local pacman_package="$4"
  local brew_package="$5"
  local sudo_cmd
  sudo_cmd="$(sudo_prefix)"

  if has_command apt-get; then
    if [[ -n "$sudo_cmd" ]]; then
      run_install "$sudo_cmd" apt-get update
      run_install "$sudo_cmd" apt-get install -y "$apt_package"
    else
      run_install apt-get update
      run_install apt-get install -y "$apt_package"
    fi
    return
  fi

  if has_command dnf; then
    if [[ -n "$sudo_cmd" ]]; then
      run_install "$sudo_cmd" dnf install -y "$dnf_package"
    else
      run_install dnf install -y "$dnf_package"
    fi
    return
  fi

  if has_command yum; then
    if [[ -n "$sudo_cmd" ]]; then
      run_install "$sudo_cmd" yum install -y "$dnf_package"
    else
      run_install yum install -y "$dnf_package"
    fi
    return
  fi

  if has_command pacman; then
    if [[ -n "$sudo_cmd" ]]; then
      run_install "$sudo_cmd" pacman -S --needed --noconfirm "$pacman_package"
    else
      run_install pacman -S --needed --noconfirm "$pacman_package"
    fi
    return
  fi

  if has_command brew; then
    run_install brew install "$brew_package"
    return
  fi

  add_warning "Cannot install $tool_name automatically. No supported package manager was found."
}

install_npm_global() {
  local tool_name="$1"
  local package_name="$2"

  if ! has_command npm; then
    add_warning "Cannot install $tool_name automatically because npm is missing."
    return
  fi

  run_install npm install -g "$package_name"
}

test_required_tool() {
  local name="$1"
  local install_hint="$2"
  local apt_package="${3:-$1}"
  local dnf_package="${4:-$1}"
  local pacman_package="${5:-$1}"
  local brew_package="${6:-$1}"

  if ! has_command "$name"; then
    if (( INSTALL == 1 )); then
      install_system_package "$name" "$apt_package" "$dnf_package" "$pacman_package" "$brew_package"
    fi

    if ! has_command "$name"; then
      add_failure "$name is missing. $install_hint"
      return
    fi
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
  local install_kind="$3"
  local install_package="$4"

  if ! has_command "$name"; then
    if (( INSTALL == 1 )); then
      if [[ "$install_kind" == "npm" ]]; then
        install_npm_global "$name" "$install_package"
      else
        install_system_package "$name" "$install_package" "$install_package" "$install_package" "$install_package"
      fi
    fi
  fi

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

install_project_dependencies() {
  if (( INSTALL_PROJECT_DEPS == 0 )); then
    return
  fi

  if [[ ! -f package.json ]]; then
    add_warning "Cannot install project dependencies because package.json does not exist yet."
    return
  fi

  if [[ -f package-lock.json ]]; then
    run_install npm ci
    return
  fi

  run_install npm install
}

install_playwright_browsers() {
  if (( INSTALL_PLAYWRIGHT == 0 )); then
    return
  fi

  if [[ ! -f package.json ]]; then
    add_warning "Cannot install Playwright browsers because package.json does not exist yet."
    return
  fi

  run_install npx playwright install
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
    add_warning "node_modules not found. Run this script with --install-project-deps."
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

test_supabase_cli() {
  local local_version=""

  if [[ -f package.json ]]; then
    local_version="$(npx supabase --version 2>/dev/null | head -n 1 || true)"
  fi

  if [[ -n "$local_version" ]]; then
    add_pass "supabase CLI $local_version via local project dependency."
    return
  fi

  if (( INSTALL_PROJECT_DEPS == 1 )) && [[ -f package.json ]]; then
    run_install npm install -D supabase
    local_version="$(npx supabase --version 2>/dev/null | head -n 1 || true)"
    if [[ -n "$local_version" ]]; then
      add_pass "supabase CLI $local_version via local project dependency."
      return
    fi
  fi

  if has_command supabase; then
    local global_version
    global_version="$(command_text supabase --version || true)"
    add_pass "supabase CLI $global_version via global install."
    return
  fi

  add_warning "supabase CLI is missing. Install it locally with: npm install -D supabase"
}

test_branch_mapping() {
  if [[ ! -d .git ]]; then
    add_warning "Git repository metadata was not found. Branch mapping check skipped."
    return
  fi

  local branch_name
  branch_name="$(git branch --show-current 2>/dev/null || true)"
  if [[ -z "$branch_name" ]]; then
    add_warning "Could not read current Git branch."
    return
  fi

  case "$branch_name" in
    dev)
      add_pass "Current branch is dev. Use local Supabase by default. Dev previews may use f1-league-manager-nonprod."
      ;;
    feature/*|fix/*)
      add_pass "Current branch is $branch_name. Treat it as dev-targeted work using local Supabase by default."
      ;;
    staging)
      add_pass "Current branch is staging. Use Supabase project f1-league-manager-nonprod."
      ;;
    prod)
      add_warning "Current branch is prod. Use only production env vars and avoid local experiments."
      ;;
    *)
      add_warning "Current branch is '$branch_name'. Confirm whether it should target dev, staging, or prod before changing env vars, migrations, seeds, imports, or deploy settings."
      ;;
  esac
}

printf "F1 League Manager developer machine check\n"
printf "Run with --install to install missing tools.\n"
printf "Run with --install-project-deps to install npm dependencies.\n"
printf "Run with --install-playwright to install Playwright browsers.\n"
printf "Run with --strict to fail on warnings too.\n"

print_header "Required Tools"
test_required_tool "git" "Install Git from your package manager." "git" "git" "git" "git"
test_required_tool "node" "Install Node.js LTS from https://nodejs.org/ or nvm." "nodejs" "nodejs" "nodejs" "node"
test_node_version
test_required_tool "npm" "npm should be installed with Node.js." "npm" "npm" "npm" "npm"

print_header "Recommended Tools"
test_optional_tool "gh" "Install GitHub CLI if you want easy repo auth: https://cli.github.com/" "system" "gh"
test_optional_tool "vercel" "Install later with: npm install -g vercel" "npm" "vercel"
test_supabase_cli
test_optional_tool "docker" "Install Docker if you want local Supabase." "system" "docker"

print_header "Project Dependencies"
install_project_dependencies
install_playwright_browsers

print_header "Project Files"
test_project_files
test_project_scripts

print_header "Branch Mapping"
test_branch_mapping

print_header "Playwright"
if [[ -f package.json ]]; then
  playwright_version="$(npx playwright --version 2>/dev/null | head -n 1 || true)"
  if [[ -z "$playwright_version" ]]; then
    add_warning "Playwright is not available yet. Run npm install after S0 setup."
  else
    add_pass "$playwright_version"
    add_warning "If E2E tests fail because browsers are missing, run this script with --install-playwright."
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
