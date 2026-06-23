// Prevents additional console window on Windows in release, do NOT remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use tauri::{Emitter, Manager, State};
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::RunEvent;

/// 暂存外部打开的文件路径（冷启动时前端监听器可能尚未就绪）
struct PendingOpenFiles(Mutex<Vec<String>>);

/// 将文件或文件夹移入系统回收站（非永久删除）
#[tauri::command]
fn move_to_trash(path: String) -> Result<(), String> {
    trash::delete(path).map_err(|e| e.to_string())
}

/// 在系统文件管理器中打开路径的上级目录并选中该项
#[tauri::command]
fn reveal_in_file_manager(path: String) -> Result<(), String> {
    let target = std::path::Path::new(&path);
    if !target.exists() {
        return Err(format!("路径不存在: {}", target.display()));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(target)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        let path = std::fs::canonicalize(target).unwrap_or_else(|_| target.to_path_buf());
        let path_str = path.display().to_string();
        // 含空格的路径需加引号，否则 explorer /select 会解析失败
        let select_arg = if path_str.contains(' ') {
            format!("/select,\"{}\"", path_str)
        } else {
            format!("/select,{}", path_str)
        };
        std::process::Command::new("explorer")
            .arg(select_arg)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = target
            .parent()
            .ok_or_else(|| "无法获取上级目录".to_string())?;
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 前端就绪后取走并清空暂存路径
#[tauri::command]
fn take_pending_open_files(state: State<PendingOpenFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

/// 判断路径是否为可打开的 Markdown / 文本文件
fn is_openable_text_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".md")
        || lower.ends_with(".markdown")
        || lower.ends_with(".txt")
}

/// 规范化命令行/关联文件传入的路径（Windows 可能带引号）
fn normalize_cli_arg(arg: &str) -> String {
    arg.trim().trim_matches('"').to_string()
}

/// 从启动参数中过滤出文件路径（跳过可执行文件本身）
fn extract_file_paths(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1)
        .map(|arg| normalize_cli_arg(arg))
        .filter(|arg| is_openable_text_file(arg))
        .collect()
}

/// 将已运行的窗口置于前台
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// 派发外部文件打开事件：聚焦窗口 + 暂存 + 通知前端
fn dispatch_open_files(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    focus_main_window(app);

    if let Some(state) = app.try_state::<PendingOpenFiles>() {
        state.0.lock().unwrap().extend(paths.clone());
    }

    // 向主窗口直接发送，确保已运行实例能立即收到
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("open-files", &paths);
    }
    let _ = app.emit("open-files", &paths);
}

/// macOS / iOS：处理系统「打开文件」事件（Windows 无此 RunEvent 变体）
#[cfg(any(target_os = "macos", target_os = "ios"))]
fn handle_opened_event(app_handle: &tauri::AppHandle, event: RunEvent) {
    if let RunEvent::Opened { urls } = event {
        let paths: Vec<String> = urls
            .iter()
            .filter_map(|url| url.to_file_path().ok())
            .map(|path| path.to_string_lossy().into_owned())
            .filter(|path| is_openable_text_file(path))
            .collect();
        dispatch_open_files(app_handle, paths);
    }
}

fn main() {
    tauri::Builder::default()
        .manage(PendingOpenFiles(Mutex::new(Vec::new())))
        // 单实例插件必须最先注册：再次双击 .md 时聚焦已有窗口并转发路径
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            dispatch_open_files(app, extract_file_paths(&argv));
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![move_to_trash, take_pending_open_files, reveal_in_file_manager])
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

                // Tauri 2 release 构建未启用 `devtools` Cargo feature 时，开发者工具默认关闭，
                // 无需（也无法）在运行时调用 set_devtools。
            }

            // Windows / Linux 冷启动：文件路径在命令行参数中
            #[cfg(not(target_os = "macos"))]
            {
                let paths = extract_file_paths(&std::env::args().collect::<Vec<_>>());
                dispatch_open_files(app.handle(), paths);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            handle_opened_event(app_handle, event);
            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            {
                let _ = (app_handle, event);
            }
        });
}
