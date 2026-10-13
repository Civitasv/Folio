#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { let _ = folio_core::APP_NAME; tauri::Builder::default().run(tauri::generate_context!()).expect("failed to run Folio"); }
