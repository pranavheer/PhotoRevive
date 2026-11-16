import sys
import os
import argparse
import time
import cv2
import numpy as np
import onnxruntime as ort

def restore_image(input_path, output_path, scale=2):
    t_start = time.time()
    
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} not found.")
        sys.exit(1)
        
    img = cv2.imread(input_path)
    if img is None:
        print(f"Error: Could not decode image {input_path}")
        sys.exit(1)
        
    orig_h, orig_w = img.shape[:2]
    print(f"[PhotoRevive Neural Engine] Input image: {orig_w}x{orig_h}")
    
    # Real-ESRGAN Super-Resolution
    scale = 4 if scale == 4 else 2
    model_path = os.path.join(os.path.dirname(__file__), 'models', f'realesrgan-x{scale}.onnx')
    
    if not os.path.exists(model_path):
        print(f"Error: Model file {model_path} not found.")
        sys.exit(1)
        
    # Prepare session with CPU optimizations
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = os.cpu_count() or 4
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(model_path, sess_options=opts, providers=['CPUExecutionProvider'])
    
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    
    # Pre-processing: convert BGR to RGB
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # For CPU efficiency on weak laptops, limit max input dimension to 1024px
    max_input_dim = 1024
    cur_h, cur_w = img_rgb.shape[:2]
    if max(cur_h, cur_w) > max_input_dim:
        ratio = max_input_dim / max(cur_h, cur_w)
        new_w = int(cur_w * ratio)
        new_h = int(cur_h * ratio)
        img_rgb = cv2.resize(img_rgb, (new_w, new_h), interpolation=cv2.INTER_AREA)
        cur_h, cur_w = new_h, new_w
        print(f"[PhotoRevive Neural Engine] Resized to {cur_w}x{cur_h} for responsive CPU processing")
        
    # Ensure dimensions are even multiples of 2
    pad_h = (2 - cur_h % 2) % 2
    pad_w = (2 - cur_w % 2) % 2
    if pad_h > 0 or pad_w > 0:
        img_rgb = cv2.copyMakeBorder(img_rgb, 0, pad_h, 0, pad_w, cv2.BORDER_REFLECT)
        
    # Normalize to [0, 1] float32 tensor: (1, 3, H, W)
    tensor = (img_rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[np.newaxis, :]
    
    print(f"[PhotoRevive Neural Engine] Running Real-ESRGAN x{scale} deep neural network...")
    t_inf = time.time()
    raw_output = session.run([output_name], {input_name: tensor})[0]
    inf_duration = time.time() - t_inf
    print(f"[PhotoRevive Neural Engine] Neural inference completed in {inf_duration:.2f}s")
    
    # Post-process tensor to image
    enhanced = raw_output[0].transpose(1, 2, 0)
    enhanced = np.clip(enhanced * 255.0, 0, 255).astype(np.uint8)
    
    # Crop out any padding added earlier
    out_h = cur_h * scale
    out_w = cur_w * scale
    enhanced = enhanced[:out_h, :out_w]
    
    # Convert RGB back to BGR for saving
    out_bgr = cv2.cvtColor(enhanced, cv2.COLOR_RGB2BGR)
    
    # Save output
    cv2.imwrite(output_path, out_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    total_duration = time.time() - t_start
    print(f"[PhotoRevive Neural Engine] Successfully saved restored asset to {output_path} ({out_w}x{out_h}) in {total_duration:.2f}s total")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="PhotoRevive Local Neural Restoration Engine")
    parser.add_argument("--input", "-i", required=True, help="Path to input image")
    parser.add_argument("--output", "-o", required=True, help="Path to output image")
    parser.add_argument("--scale", "-s", type=int, default=2, choices=[2, 4], help="Upscale factor (2 or 4)")
    args = parser.parse_args()
    
    restore_image(args.input, args.output, scale=args.scale)
