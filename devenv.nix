{ pkgs, ... }:

{
  cachix.enable = false;

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    bun.enable = true;
  };

  packages = [
    pkgs.git
    pkgs.jq
    pkgs.typescript
    pkgs.wrangler
  ];

  processes.rin.exec = "bun run dev";

  enterShell = ''
    if [ ! -f .env.local ]; then
      echo "warning: .env.local is missing. Run: cp .env.example .env.local"
    fi
    echo "devenv ready: run 'devenv up' to start Rin."
  '';

  enterTest = ''
    bun run test:server
  '';
}
