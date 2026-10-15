#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod api;
fn main() {
 let _=folio_core::APP_NAME;
 tauri::Builder::default()
  .manage(api::ApiState::default())
  .invoke_handler(tauri::generate_handler![
   api::folio_api_save_key,api::folio_api_has_key,api::folio_api_clear_key,api::folio_api_translate,api::folio_api_cancel
  ])
  .run(tauri::generate_context!()).expect("failed to run Folio");
}
