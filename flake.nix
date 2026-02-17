{
  description = "Rin development environment";

  inputs = {
    nixpkgs.url = "github:cachix/devenv-nixpkgs/rolling";
    devenv.url = "github:cachix/devenv";

    git-hooks.url = "github:cachix/git-hooks.nix";
    git-hooks.inputs.nixpkgs.follows = "nixpkgs";
    pre-commit-hooks.follows = "git-hooks";
  };

  nixConfig = {
    allow-import-from-derivation = true;
    pure-eval = false;
    extra-substituters = [
      "https://devenv.cachix.org"
      "https://cachix.cachix.org"
    ];
    extra-trusted-public-keys = [
      "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw="
      "cachix.cachix.org-1:eWNHQldwUO7G2VkjpnjDbWwy4KQ/HNxht7H4SSoMckM="
    ];
  };

  outputs =
    { nixpkgs, devenv, ... }@inputs:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f system nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forEachSystem (
        _system: pkgs: {
          default = devenv.lib.mkShell {
            inherit inputs pkgs;
            modules = [ ./devenv.nix ];
          };
        }
      );

      formatter = forEachSystem (
        _system: pkgs:
        pkgs.writeShellApplication {
          name = "rin-treefmt";
          runtimeInputs = [
            pkgs.actionlint
            pkgs.biome
            pkgs.nixfmt
            pkgs.shfmt
            pkgs.taplo
            pkgs.treefmt
          ];
          text = ''
            exec treefmt --config-file .treefmt.toml "$@"
          '';
        }
      );
    };
}
