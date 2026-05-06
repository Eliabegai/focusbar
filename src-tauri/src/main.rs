// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem,
};

fn build_tray() -> SystemTray {
    let status = CustomMenuItem::new("status".to_string(), "FocusBar iniciando...")
        .disabled();
    let show = CustomMenuItem::new("show".to_string(), "Mostrar");
    let hide = CustomMenuItem::new("hide".to_string(), "Minimizar");
    let sep = SystemTrayMenuItem::Separator;
    let quit = CustomMenuItem::new("quit".to_string(), "Sair");

    let menu = SystemTrayMenu::new()
        .add_item(status)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(show)
        .add_item(hide)
        .add_native_item(sep)
        .add_item(quit);

    SystemTray::new().with_menu(menu).with_tooltip("FocusBar")
}

fn handle_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick { .. } => {
            let window = app.get_window("main").unwrap();
            if window.is_visible().unwrap_or(false) {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "status" => {}
            "show" => {
                let window = app.get_window("main").unwrap();
                let _ = window.show();
                let _ = window.set_focus();
            }
            "hide" => {
                let window = app.get_window("main").unwrap();
                let _ = window.hide();
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        },
        _ => {}
    }
}

#[tauri::command]
#[allow(non_snake_case)]
fn update_tray_title(
    app: tauri::AppHandle,
    title: String,
    always_visible: Option<bool>,
    alwaysVisible: Option<bool>,
) {
    let tray = app.tray_handle();
    let is_always_visible = always_visible.or(alwaysVisible).unwrap_or(true);
    let _ = tray.set_tooltip(&title);
    let _ = tray.get_item("status").set_title(&title);

    // No macOS, o texto pode aparecer ao lado do ícone na menu bar.
    #[cfg(target_os = "macos")]
    {
        let menu_title = if is_always_visible {
            title
        } else {
            String::new()
        };
        let _ = tray.set_title(&menu_title);
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![update_tray_title])
        .system_tray(build_tray())
        .on_system_tray_event(handle_tray_event)
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.set_always_on_top(true)?;
            let _ = app.tray_handle().set_tooltip("FocusBar");
            let _ = app.tray_handle().get_item("status").set_title("FocusBar ativo");
            #[cfg(target_os = "macos")]
            {
                let _ = app.tray_handle().set_title("FocusBar");
            }
            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
