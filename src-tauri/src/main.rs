// Prevents additional console window on Windows in release, do NOT remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager, RunEvent};

/// 将文件或文件夹移入系统回收站（非永久删除）
#[tauri::command]
fn move_to_trash(path: String) -> Result<(), String> {
    trash::delete(path).map_err(|e| e.to_string())
}

/// 判断路径是否为可打开的 Markdown / 文本文件
fn is_openable_text_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".md")
        || lower.ends_with(".markdown")
        || lower.ends_with(".txt")
}

/// 从启动参数中过滤出文件路径（跳过可执行文件本身）
fn extract_file_paths(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|arg| is_openable_text_file(arg))
        .cloned()
        .collect()
}

/// 通知前端打开外部传入的文件
fn emit_open_files(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let _ = app.emit("open-files", paths);
}

/// 将已运行的窗口置于前台
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 延迟发送打开文件事件，等待前端监听器就绪
fn schedule_emit_open_files(app: tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(600));
        emit_open_files(&app, paths);
    });
}

fn main() {
    tauri::Builder::default()
        // 单实例插件必须最先注册：再次双击 .md 时聚焦已有窗口并转发路径
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            focus_main_window(app);
            emit_open_files(app, extract_file_paths(&argv));
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![move_to_trash])
        .setup(|app| {
            // 强制窗口最小尺寸（tauri.conf 在 macOS 上有时不会落到 NSWindow）
            if let Some(window) = app.get_webview_window("main") {
                use tauri::{LogicalSize, Size};

                const MIN_WIDTH: f64 = 800.0;
                const MIN_HEIGHT: f64 = 600.0;

                let _ = window.set_min_size(Some(Size::Logical(LogicalSize::new(
                    MIN_WIDTH, MIN_HEIGHT,
                ))));

                // 系统若恢复了过小的窗口，启动时抬到最小尺寸
                if let Ok(physical) = window.inner_size() {
                    let scale = window.scale_factor().unwrap_or(1.0);
                    let w = physical.width as f64 / scale;
                    let h = physical.height as f64 / scale;
                    if w < MIN_WIDTH || h < MIN_HEIGHT {
                        let _ = window.set_size(Size::Logical(LogicalSize::new(
                            w.max(MIN_WIDTH),
                            h.max(MIN_HEIGHT),
                        )));
                    }
                }
            }

            // Windows / Linux 冷启动：文件路径在命令行参数中
            #[cfg(not(target_os = "macos"))]
            {
                let paths = extract_file_paths(&std::env::args().collect::<Vec<_>>());
                schedule_emit_open_files(app.handle().clone(), paths);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            // macOS 冷启动 / 「打开方式」：通过 Opened 事件接收文件 URL
            if let RunEvent::Opened { urls } = event {
                focus_main_window(app_handle);
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|path| path.to_string_lossy().into_owned())
                    .filter(|path| is_openable_text_file(path))
                    .collect();
                schedule_emit_open_files(app_handle.clone(), paths);
            }
        });
}
