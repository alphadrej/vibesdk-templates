#!/bin/bash

set -euo pipefail

echo "🚀 Starting template deployment process..."

# Ensure PyYAML is installed
echo "🐍 Checking Python dependencies..."
if ! python3 -c "import yaml" 2>/dev/null; then
    echo "📦 Installing PyYAML..."
    pip3 install pyyaml || pip install pyyaml || {
        echo "❌ Failed to install PyYAML. Please install it manually: pip install pyyaml"
        exit 1
    }
    echo "✅ PyYAML installed successfully"
else
    echo "✅ PyYAML is already installed"
fi

# 1) Generate templates into build/
echo "🧱 Generating templates into build/..."
python3 tools/generate_templates.py --clean
echo "✅ Templates generated"

# 2) Generate template catalog (generate_template_catalog.py now defaults to ./build)
echo "📋 Generating template catalog..."
python3 generate_template_catalog.py --output template_catalog.json --pretty
echo "✅ Generated template catalog"

# Create optimized zip files for templates
echo "📦 Creating optimized zip files for templates..."

# Recreate the archive directory so repository-controlled symlinks cannot survive.
rm -rf -- zips
mkdir -- zips

# Function to create fast-extracting zip files using Python
create_template_zip() {
  local template_dir="$1"
  local template_name
  template_name=$(basename "$template_dir")
  local zip_file="zips/${template_name}.zip"
  
  echo "Creating zip for: $template_name"
  
  # Use Python script to create zip (compatible with environments without zip command)
  if python3 create_zip.py "$template_dir" "$zip_file"; then
    # Verify the zip file was created
    if [ -f "$zip_file" ]; then
      local size
      size=$(du -h "$zip_file" | cut -f1)
      echo "✅ Created $zip_file ($size)"
    else
      echo "❌ Failed to create $zip_file"
      return 1
    fi
  else
    echo "❌ Failed to create $zip_file using Python"
    return 1
  fi
}

# 3) Create zip for each catalog-listed template directory in parallel
pids=()
while IFS= read -r template_name; do
  if [ -z "$template_name" ]; then
    continue
  fi
  dir="build/${template_name}/"
  if [[ -f "$dir/package.json" && (-f "$dir/wrangler.jsonc" || -f "$dir/wrangler.toml") && -d "$dir/prompts" ]]; then
    create_template_zip "$dir" &
    pids+=("$!")
  else
    echo "❌ Catalog template $template_name is missing or invalid in build/"
    exit 1
  fi
done < <(
  python3 -c 'import json; print("\n".join(item["name"] for item in json.load(open("template_catalog.json", encoding="utf-8"))))'
)

# Wait for all zip creation processes to complete
echo "⏳ Waiting for all zip creation processes to complete..."
for pid in "${pids[@]}"; do
  wait "$pid"
done

echo "📦 All template zips created successfully"
ls -la zips/

# Verify Wrangler CLI is available
echo "⚙️  Verifying Wrangler CLI..."
wrangler --version
echo "✅ Wrangler CLI ready"

# Determine R2 endpoint based on LOCAL_R2 environment variable
if [ "${LOCAL_R2:-}" = "true" ]; then
  echo "🏠 LOCAL_R2=true - using local R2 endpoint"
  R2_FLAGS=("--local")
  R2_ENDPOINT="local R2"
else
  echo "☁️  Using remote Cloudflare R2"
  R2_FLAGS=("--remote")
  R2_ENDPOINT="Cloudflare R2"
fi

# Upload files to R2
echo "🚀 Uploading files to $R2_ENDPOINT..."

# Function to upload a file to R2
upload_to_r2() {
  local file_path="$1"
  local r2_key="$2"
  local description="$3"
  
  echo "Uploading: $description"
  if wrangler r2 object put "${R2_BUCKET_NAME}/$r2_key" --file="$file_path" "${R2_FLAGS[@]}"; then
    echo "✅ Successfully uploaded $description"
    return 0
  else
    echo "❌ Failed to upload $description"
    return 1
  fi
}

# Upload template catalog JSON and all zip files
if [ "${LOCAL_R2:-}" = "true" ]; then
  echo "📄📦 Uploading template catalog and zip files sequentially (local R2)..."
  failed_uploads=()

  # Upload catalog first
  if ! upload_to_r2 "template_catalog.json" "template_catalog.json" "template_catalog.json"; then
    failed_uploads+=("template_catalog.json upload failed")
  fi

  # Upload zip files sequentially
  for zip_file in zips/*.zip; do
    if [ -f "$zip_file" ]; then
      filename=$(basename "$zip_file")
      if ! upload_to_r2 "$zip_file" "$filename" "$filename"; then
        failed_uploads+=("$filename upload failed")
      fi
    fi
  done
else
  echo "📄📦 Uploading template catalog and zip files in parallel..."
  upload_pids=()
  failed_uploads=()

  # Start catalog upload in background
  upload_to_r2 "template_catalog.json" "template_catalog.json" "template_catalog.json" &
  upload_pids+=("$!")

  # Start zip file uploads in background
  for zip_file in zips/*.zip; do
    if [ -f "$zip_file" ]; then
      filename=$(basename "$zip_file")
      upload_to_r2 "$zip_file" "$filename" "$filename" &
      upload_pids+=("$!")
    fi
  done

  # Wait for all uploads to complete and check for failures
  echo "⏳ Waiting for all uploads to complete..."
  for pid in "${upload_pids[@]}"; do
    if ! wait "$pid"; then
      failed_uploads+=("Upload process $pid failed")
    fi
  done
fi

# Check if any uploads failed
if [ ${#failed_uploads[@]} -gt 0 ]; then
  echo "❌ Some uploads failed:"
  for failure in "${failed_uploads[@]}"; do
    echo "  - $failure"
  done
  exit 1
fi

echo "🎉 All files uploaded successfully to $R2_ENDPOINT bucket: ${R2_BUCKET_NAME}"

# Skip verification as wrangler doesn't have a list command
echo "✅ All uploads completed successfully"

# Generate deployment summary for GitHub Actions
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "## 🚀 Deployment Summary" >> $GITHUB_STEP_SUMMARY
  echo "" >> $GITHUB_STEP_SUMMARY
  echo "### 📋 Template Catalog" >> $GITHUB_STEP_SUMMARY
  echo "- ✅ Generated and uploaded \`template_catalog.json\`" >> $GITHUB_STEP_SUMMARY
  echo "" >> $GITHUB_STEP_SUMMARY
  echo "### 📦 Template Archives" >> $GITHUB_STEP_SUMMARY
  
  # Count and list zip files
  zip_count=$(ls zips/*.zip 2>/dev/null | wc -l)
  echo "- ✅ Created and uploaded $zip_count template zip files:" >> $GITHUB_STEP_SUMMARY
  
  for zip_file in zips/*.zip; do
    if [ -f "$zip_file" ]; then
      filename=$(basename "$zip_file" .zip)
      size=$(du -h "$zip_file" | cut -f1)
      echo "  - \`$filename\` ($size)" >> $GITHUB_STEP_SUMMARY
    fi
  done
  
  echo "" >> $GITHUB_STEP_SUMMARY
  echo "### 🌐 Access URLs" >> $GITHUB_STEP_SUMMARY
  if [ "${LOCAL_R2:-}" = "true" ]; then
    echo "- **Target**: Local R2 (${R2_BUCKET_NAME})" >> $GITHUB_STEP_SUMMARY
    echo "- **Note**: Files uploaded to local R2 development environment" >> $GITHUB_STEP_SUMMARY
  else
    echo "- **Catalog**: \`https://${R2_BUCKET_NAME}.r2.dev/template_catalog.json\`" >> $GITHUB_STEP_SUMMARY
    echo "- **Templates**: \`https://${R2_BUCKET_NAME}.r2.dev/[template-name].zip\`" >> $GITHUB_STEP_SUMMARY
  fi
  echo "" >> $GITHUB_STEP_SUMMARY
  echo "🕐 **Deployed at**: $(date -u +%Y-%m-%d\ %H:%M:%S\ UTC)" >> $GITHUB_STEP_SUMMARY
fi

echo "🎯 Template deployment completed successfully!"
