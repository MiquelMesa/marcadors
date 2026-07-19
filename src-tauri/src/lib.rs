use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

struct ServerProcess(Mutex<Option<Child>>);

fn start_server(app: &tauri::AppHandle) -> Option<Child> {
    let resource_dir = app.path().resource_dir().expect("failed to resolve resource dir");

    let server_exe = resource_dir.join("server.exe");
    if !server_exe.exists() {
        eprintln!("server.exe not found in resource directory");
        return None;
    }

    match Command::new(&server_exe).current_dir(&resource_dir).spawn() {
        Ok(child) => {
            poll_until_ready("http://localhost:3000/marcadores/api/clasificacion-guardada", 30);
            Some(child)
        }
        Err(e) => {
            eprintln!("Failed to start server: {e}");
            None
        }
    }
}

fn poll_until_ready(url: &str, max_attempts: u32) {
    for _ in 0..max_attempts {
        if reqwest::blocking::get(url).is_ok() {
            return;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    eprintln!("Server did not start within {} attempts", max_attempts);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // In dev mode, beforeDevCommand starts the server — skip here
            if cfg!(not(debug_assertions)) {
                let child = start_server(app.handle());
                app.manage(ServerProcess(Mutex::new(child)));
            } else {
                app.manage(ServerProcess(Mutex::new(None)));
            }

            let _window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("http://localhost:3000/marcadores/".parse().unwrap()),
            )
            .title("Marcadors")
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
