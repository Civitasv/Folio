use std::{fs, path::Path};
fn main() {
 let path = Path::new("icons/icon.png");
 if !path.exists() {
  fs::create_dir_all("icons").expect("create icons dir");
  let file = fs::File::create(path).expect("create placeholder icon");
  let mut encoder = png::Encoder::new(file, 1, 1);
  encoder.set_color(png::ColorType::Rgba);
  encoder.set_depth(png::BitDepth::Eight);
  encoder.write_header().expect("png header").write_image_data(&[31,31,31,255]).expect("png data");
 }
 tauri_build::build();
}
