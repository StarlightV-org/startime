use zed_extension_api as zed;

const LSP_PACKAGE: &str = "@starlightv-org/zed-startime-lsp";
const LOCAL_LSP_PACKAGE: &str = "packages/zed-startime-lsp/package.json";
const LOCAL_LSP_ENTRYPOINT: &str = "packages/zed-startime-lsp/dist/index.js";
const LSP_BINARY: &str = "node_modules/.bin/startime-lsp";
const WINDOWS_LSP_BINARY: &str = "node_modules/.bin/startime-lsp.cmd";

struct StartimeExtension;

impl zed::Extension for StartimeExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command, String> {
        if worktree.read_text_file(LOCAL_LSP_PACKAGE).is_ok() {
            return Ok(zed::Command {
                command: zed::node_binary_path()?,
                args: vec![format!("{}/{LOCAL_LSP_ENTRYPOINT}", worktree.root_path())],
                env: vec![],
            });
        }

        if zed::npm_package_installed_version(LSP_PACKAGE)?.is_none() {
            zed::npm_install_package(LSP_PACKAGE, "latest")?;
        }

        let lsp_binary = match zed::current_platform().0 {
            zed::Os::Windows => WINDOWS_LSP_BINARY,
            zed::Os::Mac | zed::Os::Linux => LSP_BINARY,
        };

        Ok(zed::Command {
            command: lsp_binary.to_string(),
            args: vec![],
            env: vec![],
        })
    }
}

zed::register_extension!(StartimeExtension);
