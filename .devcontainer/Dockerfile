# Devcontainer for vscode-backlog.md development
# amd64 required for vscode-extension-tester support (set in devcontainer.json)
# https://github.com/redhat-developer/vscode-extension-tester/issues/506
FROM mcr.microsoft.com/devcontainers/javascript-node:22

ARG CLAUDE_CODE_VERSION=latest

# Install additional development tools and Electron/VS Code dependencies
RUN apt-get update && apt-get install -y \
    git \
    jq \
    zsh \
    curl \
    nano \
    vim \
    unzip \
    gnupg2 \
    fzf \
    # Electron/VS Code dependencies for e2e tests
    dbus \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
    chown -R node:node /usr/local/share

ARG USERNAME=node

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
    && mkdir /commandhistory \
    && touch /commandhistory/.bash_history \
    && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
    chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
    wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
    sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
    rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install mise (polyglot version manager for Node.js and Bun)
COPY --from=jdxcode/mise /usr/local/bin/mise /usr/local/bin/mise

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/bin/
ENV PATH=$PATH:/usr/local/share/npm-global/bin
ENV PATH=$PATH:/home/node/.local/bin
ENV PATH=$PATH:/home/node/.local/share/mise/shims

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# explicitly set uv venv path so we don't stomp on host-local .venv
ENV UV_PROJECT_ENVIRONMENT=.venv_devcontainer
ENV UV_LINK_MODE=copy

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
    -p git \
    -p fzf \
    -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
    -a "source /usr/share/doc/fzf/examples/completion.zsh" \
    -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
    -x

# Activate mise in shells
RUN echo 'eval "$(mise activate zsh)"' >> /home/node/.zshrc && \
    echo 'eval "$(mise activate bash)"' >> /home/node/.bashrc

# Install Claude
RUN curl -fsSL https://claude.ai/install.sh | bash -s -- $CLAUDE_CODE_VERSION

# Pre-install mise tools (Node + Bun) for faster container startup
RUN printf '[tools]\nnode = "22"\nbun = "latest"\n' > /workspace/mise.toml && \
    mise trust --yes /workspace/mise.toml && \
    mise install

RUN mise exec -- bun i -g backlog.md 
# you'll need to run `claude mcp add backlog --scope user -- backlog mcp start` the first time you use it