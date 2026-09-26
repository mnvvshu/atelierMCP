#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ASCII Art Banner
print_banner() {
    echo -e "${CYAN}"
    cat << "EOF"
         _       _                     __  __  ____  ____  
        / \   _ | |_  ___ | |(_) ___ _ __|  \/  |/ ___||  _ \ 
       / _ \ | __|/ _ \| || |/ _ \ '__| |\/| | |    | |_) |
      / ___ \| |_|  __/ | | |  __/ |  | |  | | |___ |  __/ 
     /_/   \_\\__|\___|_|_|_|\___|_|  |_|  |_|\____||_|    
                                                           
EOF
    echo -e "${NC}"
}

# Error handling and cleanup
error_exit() {
    echo -e "${RED}Error: $1${NC}" >&2
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        echo -e "${YELLOW}Cleaning up temporary files...${NC}"
        rm -rf "$TEMP_DIR"
    fi
    exit 1
}

trap 'error_exit "Installation interrupted"' INT TERM

# Parse arguments
INSTALL_DIR="${ATELIER_HOME:-$HOME/.atelier-mcp}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
done

REPO_URL="https://github.com/USER/atelier-mcp.git"

print_banner
echo -e "${GREEN}Starting Atelier MCP installation...${NC}\n"

# Check OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          error_exit "Unsupported OS: ${OS}. This script supports Linux and macOS.";;
esac
echo -e "${CYAN}Detected OS: ${MACHINE}${NC}"

# Check for Git
if ! command -v git &> /dev/null; then
    error_exit "git is not installed. Please install git and try again."
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    error_exit "Node.js is not installed. Please install Node.js 20.19+ (20.x) or 22.12+ and try again."
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1)
NODE_MINOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f2)

if ! { { [ "$NODE_MAJOR_VERSION" -eq 20 ] && [ "$NODE_MINOR_VERSION" -ge 19 ]; } || { [ "$NODE_MAJOR_VERSION" -eq 22 ] && [ "$NODE_MINOR_VERSION" -ge 12 ]; } || [ "$NODE_MAJOR_VERSION" -gt 22 ]; }; then
    error_exit "Node.js 20.19+ (20.x) or 22.12+ is required. Found version $NODE_VERSION"
fi
echo -e "${CYAN}Found Node.js v${NODE_VERSION}${NC}"

# Clone Repository
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Warning: Installation directory $INSTALL_DIR already exists.${NC}"
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        error_exit "Installation aborted by user."
    fi
fi

echo -e "${CYAN}Cloning repository to $INSTALL_DIR...${NC}"
git clone --quiet "$REPO_URL" "$INSTALL_DIR" || error_exit "Failed to clone repository."

# Install dependencies and build
cd "$INSTALL_DIR"
echo -e "${CYAN}Installing npm dependencies...${NC}"
npm install --silent || error_exit "Failed to install dependencies."

echo -e "${CYAN}Building packages...${NC}"
npm run build --silent || error_exit "Failed to build project."

# Setup CLI command
BIN_DIR="$HOME/.local/bin"
if [ "$EUID" -eq 0 ]; then
    BIN_DIR="/usr/local/bin"
fi

echo -e "${CYAN}Setting up CLI symlink in $BIN_DIR...${NC}"
mkdir -p "$BIN_DIR"

# Create a robust wrapper script to run the CLI
CLI_WRAPPER="$BIN_DIR/atelier"
cat << EOF > "$CLI_WRAPPER"
#!/usr/bin/env bash
# Atelier MCP CLI wrapper
cd "$INSTALL_DIR" && npm start --workspace=packages/cli -- "\$@"
EOF
chmod +x "$CLI_WRAPPER" || error_exit "Failed to make CLI executable."

# Check if BIN_DIR is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo -e "${YELLOW}Note: $BIN_DIR is not in your PATH.${NC}"
    echo -e "${YELLOW}You may need to add it to your ~/.bashrc, ~/.zshrc, or equivalent:${NC}"
    echo -e "  export PATH=\"\$PATH:$BIN_DIR\""
fi

echo -e "\n${GREEN}Installation successful!${NC}"
echo -e "You can now run Atelier MCP using the '${CYAN}atelier${NC}' command."
echo -e "\nNext steps:"
echo -e "  1. Run '${CYAN}atelier --help${NC}' to get started."
echo -e "  2. Explore recipes in $INSTALL_DIR/packages/recipes"
