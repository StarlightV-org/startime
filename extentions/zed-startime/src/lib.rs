use zed_extension_api as zed;

const LSP_PACKAGE: &str = "@starlightv-org/zed-startime-lsp";
const LOCAL_LSP_PACKAGE: &str = "packages/zed-startime-lsp/dist/index.js";
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
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command, String> {
        let lsp_settings = zed::settings::LspSettings::for_worktree("startime", worktree)?;
        if let Some(binary) = lsp_settings.binary {
            if let Some(path) = binary.path {
                return Ok(zed::Command {
                    command: path,
                    args: binary.arguments.unwrap_or_default(),
                    env: binary.env.unwrap_or_default().into_iter().collect(),
                });
            }
        }

        if worktree.read_text_file(LOCAL_LSP_PACKAGE).is_ok() {
            return Ok(zed::Command {
                command: zed::node_binary_path()?,
                args: vec![format!("{}/{LOCAL_LSP_ENTRYPOINT}", worktree.root_path())],
                env: vec![],
            });
        }

        let installed_version = zed::npm_package_installed_version(LSP_PACKAGE)?;
        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        match zed::npm_package_latest_version(LSP_PACKAGE) {
            Ok(latest_version) if installed_version.as_ref() != Some(&latest_version) => {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Downloading,
                );

                if let Err(error) = zed::npm_install_package(LSP_PACKAGE, &latest_version) {
                    if installed_version.is_none() {
                        return Err(error);
                    }
                }
            }
            Err(error) if installed_version.is_none() => return Err(error),
            _ => {}
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
