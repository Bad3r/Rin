{ pkgs, config, ... }:

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
    pkgs.treefmt
    pkgs.nixfmt
    pkgs.shfmt
    pkgs.taplo
    pkgs.actionlint
    pkgs.yamllint
    pkgs.wrangler
  ];

  git-hooks.configPath = ".devenv/pre-commit-config.yaml";

  git-hooks.hooks = {
    treefmt-check = {
      enable = true;
      name = "treefmt check";
      entry = "treefmt --config-file .treefmt.toml --fail-on-change";
      language = "system";
      pass_filenames = true;
      stages = [ "pre-commit" ];
      types = [ "file" ];
    };

    actionlint-check = {
      enable = true;
      name = "actionlint";
      entry = "actionlint -shellcheck= -ignore 'the runner of \".*\" action is too old to run on GitHub Actions'";
      language = "system";
      pass_filenames = false;
      always_run = true;
      stages = [ "pre-push" ];
    };

    yamllint-check = {
      enable = true;
      name = "yamllint";
      entry = "yamllint -s -c .yamllint.yaml .";
      language = "system";
      pass_filenames = false;
      always_run = true;
      stages = [ "pre-push" ];
    };

    biome-check = {
      enable = true;
      name = "biome check";
      entry = "bunx @biomejs/biome@2.4.0 lint --files-ignore-unknown=true client server packages cli docs scripts package.json turbo.json biome.json";
      language = "system";
      pass_filenames = false;
      always_run = true;
      stages = [ "pre-push" ];
    };
  };

  processes.rin.exec = "bun run dev";

  enterShell = ''
    ${config.git-hooks.installationScript}

    if [ ! -f .env.local ]; then
      echo "warning: .env.local is missing. Run: cp .env.example .env.local"
    fi
    echo "devenv ready: run 'devenv up' to start Rin."
  '';

  enterTest = ''
    bun run test:server
  '';
}
