/**
 * Nutrolix Cloudinary Direct Image Uploader
 * Uploads images directly from the Admin browser to Cloudinary CDN
 * Zero server load, permanent global CDN hosting for Vercel and Android.
 */
window.CloudinaryService = {
  defaultSettings: {
    cloudName: "dm7q0f9xk", // demo/default cloud or user configured
    uploadPreset: "nutrolix_preset"
  },

  getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem("nutrolix_cloudinary_settings") || "null");
      if (saved && saved.cloudName) {
        return {
          cloudName: saved.cloudName.trim(),
          uploadPreset: (saved.uploadPreset || "nutrolix_preset").trim()
        };
      }
    } catch (_) {}
    return { ...this.defaultSettings };
  },

  saveSettings(cloudName, uploadPreset) {
    const settings = {
      cloudName: (cloudName || "").trim(),
      uploadPreset: (uploadPreset || "nutrolix_preset").trim(),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem("nutrolix_cloudinary_settings", JSON.stringify(settings));
    return settings;
  },

  /**
   * Upload File to Cloudinary
   * @param {File|Blob} file 
   * @param {Function} onProgress 
   * @returns {Promise<string>} secure_url
   */
  async uploadImage(file, onProgress) {
    if (!file) throw new Error("No image file selected.");

    const settings = this.getSettings();
    if (!settings.cloudName || !settings.uploadPreset) {
      throw new Error("Please configure Cloudinary Cloud Name and Upload Preset in Store Settings.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", settings.uploadPreset);
    formData.append("folder", "nutrolix_catalog");

    const endpoint = `https://api.cloudinary.com/v1_1/${settings.cloudName}/image/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint, true);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.secure_url) {
              resolve(data.secure_url);
            } else if (data.url) {
              resolve(data.url);
            } else {
              reject(new Error("Cloudinary response missing secure_url"));
            }
          } catch (err) {
            reject(new Error("Invalid JSON response from Cloudinary"));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            const msg = err.error?.message || "Upload failed (Status " + xhr.status + ")";
            reject(new Error(msg));
          } catch (_) {
            reject(new Error("Cloudinary upload failed with HTTP " + xhr.status));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network connection error while uploading to Cloudinary"));
      };

      xhr.send(formData);
    });
  },

  /**
   * Generic Helper to attach Cloudinary file picker to any input and preview
   * @param {string} targetInputId 
   * @param {string} previewImgId 
   * @param {string} statusTextId 
   */
  pickAndUpload(targetInputId, previewImgId, statusTextId) {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";

    fileInput.onchange = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const statusEl = statusTextId ? document.getElementById(statusTextId) : null;
      if (statusEl) {
        statusEl.innerText = "⏳ Uploading to Cloudinary (0%)...";
        statusEl.className = "text-[11px] font-bold text-amber-600 animate-pulse";
      }

      try {
        const cdnUrl = await this.uploadImage(file, (pct) => {
          if (statusEl) statusEl.innerText = `⏳ Uploading to Cloudinary (${pct}%)...`;
        });

        // Set in target input
        const targetInput = document.getElementById(targetInputId);
        if (targetInput) {
          targetInput.value = cdnUrl;
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
          targetInput.dispatchEvent(new Event("change", { bubbles: true }));
        }

        // Set in preview img
        if (previewImgId) {
          const previewImg = document.getElementById(previewImgId);
          if (previewImg) previewImg.src = cdnUrl;
        }

        if (statusEl) {
          statusEl.innerText = "✓ Uploaded to Cloudinary CDN!";
          statusEl.className = "text-[11px] font-bold text-emerald-600";
        }
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        // Fallback: If Cloudinary fails due to preset/credentials, offer local/base64 read
        if (statusEl) {
          statusEl.innerText = "Notice: " + err.message;
          statusEl.className = "text-[11px] font-bold text-rose-600";
        }
        alert("Cloudinary Upload Notice: " + err.message + "\n\nTip: You can set your own Cloud Name and Upload Preset in Admin > Store Settings > Cloudinary.");
      } finally {
        fileInput.remove();
      }
    };

    document.body.appendChild(fileInput);
    fileInput.click();
  }
};
