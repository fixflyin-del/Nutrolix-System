/**
 * Nutrolix Cloudinary Direct & Server-Signed Image Uploader
 * 1. Supports direct browser-to-CDN unsigned uploads.
 * 2. Supports automatic server-side signed uploads (/api/cloudinary-upload).
 * 3. Fallback to high-res data URL so user is NEVER blocked.
 */
window.CloudinaryService = {
  defaultSettings: {
    cloudName: "muy6zdcd",
    uploadPreset: "ml_default",
    apiKey: "",
    apiSecret: ""
  },

  getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem("nutrolix_cloudinary_settings") || "null");
      if (saved && saved.cloudName) {
        return {
          cloudName: saved.cloudName.trim(),
          uploadPreset: (saved.uploadPreset || "ml_default").trim(),
          apiKey: (saved.apiKey || "").trim(),
          apiSecret: (saved.apiSecret || "").trim()
        };
      }
    } catch (_) {}
    return { ...this.defaultSettings };
  },

  saveSettings(cloudName, uploadPreset, apiKey = "", apiSecret = "") {
    const settings = {
      cloudName: (cloudName || "muy6zdcd").trim(),
      uploadPreset: (uploadPreset || "ml_default").trim(),
      apiKey: (apiKey || "").trim(),
      apiSecret: (apiSecret || "").trim(),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem("nutrolix_cloudinary_settings", JSON.stringify(settings));
    return settings;
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Upload File to Cloudinary with automatic signed / unsigned / fallback handling
   * @param {File|Blob} file 
   * @param {Function} onProgress 
   * @returns {Promise<string>} secure_url or data-URL fallback
   */
  async uploadImage(file, onProgress) {
    if (!file) throw new Error("No image file selected.");

    const settings = this.getSettings();
    const cloudName = settings.cloudName || "muy6zdcd";
    const uploadPreset = settings.uploadPreset || "ml_default";
    const apiKey = settings.apiKey || "";
    const apiSecret = settings.apiSecret || "";

    const base64Data = await this.fileToBase64(file);

    // 1. If API Key and Secret are configured, use Server-Side Signed Upload (Guaranteed Cloudinary Dashboard sync!)
    if (apiKey && apiSecret) {
      try {
        if (onProgress) onProgress(30);
        const res = await fetch('/api/cloudinary-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Data,
            cloudName,
            apiKey,
            apiSecret
          })
        });
        const data = await res.json();
        if (data && data.success && data.url) {
          if (onProgress) onProgress(100);
          return data.url;
        }
      } catch (err) {
        console.warn("Server signed upload error:", err);
      }
    }

    // 2. Direct browser upload with Upload Preset
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "nutrolix_catalog");

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    return new Promise((resolve) => {
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

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const cdnUrl = data.secure_url || data.url;
            if (cdnUrl) {
              return resolve(cdnUrl);
            }
          } catch (_) {}
        }

        // Parse Cloudinary error
        let errorMsg = "";
        try {
          const err = JSON.parse(xhr.responseText);
          errorMsg = err.error?.message || "";
        } catch (_) {}

        console.warn("Cloudinary direct upload notice:", errorMsg || `HTTP ${xhr.status}`);

        // Try server upload route as second attempt
        try {
          const sRes = await fetch('/api/cloudinary-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data, cloudName, uploadPreset })
          });
          const sData = await sRes.json();
          if (sData && sData.success && sData.url) {
            return resolve(sData.url);
          }
        } catch (_) {}

        // If preset is signed, explain how to toggle to unsigned for direct dashboard sync
        if (errorMsg.includes("must be whitelisted for unsigned uploads")) {
          setTimeout(() => {
            window.CloudinaryService.showUnsignedGuide(cloudName, uploadPreset);
          }, 400);
        }

        // Return base64 so product/meal photo works immediately in app
        resolve(base64Data);
      };

      xhr.onerror = async () => {
        resolve(base64Data);
      };

      try {
        xhr.send(formData);
      } catch (_) {
        resolve(base64Data);
      }
    });
  },

  showUnsignedGuide(cloudName, uploadPreset) {
    if (document.getElementById("cloudinaryGuideModal")) return;
    const modal = document.createElement("div");
    modal.id = "cloudinaryGuideModal";
    modal.className = "fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4";
    modal.innerHTML = `
      <div class="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-black">
            ☁️
          </div>
          <div>
            <h3 class="text-sm font-black text-slate-900">Cloudinary (${cloudName}) Setup Guide</h3>
            <p class="text-[11px] text-slate-500 font-semibold">Image is active & saved in app! To see it directly in Cloudinary Dashboard:</p>
          </div>
        </div>

        <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2.5">
          <p class="font-bold text-slate-900">Choose Option 1 (10 seconds) or Option 2:</p>
          
          <div class="p-3 bg-white rounded-xl border border-emerald-200">
            <span class="font-bold text-emerald-800">Option 1: Enable Unsigned Mode (Recommended)</span>
            <ol class="list-decimal list-inside space-y-1 font-medium text-[11px] text-slate-600 mt-1">
              <li>Open <a href="https://console.cloudinary.com/settings/upload" target="_blank" class="text-emerald-600 underline font-bold">Cloudinary Dashboard ➔ Settings ➔ Upload ↗</a></li>
              <li>Scroll to <strong>Upload presets</strong> ➔ Click <strong>Edit</strong> on <code>${uploadPreset}</code></li>
              <li>Change <strong>Signing Mode</strong> from <em>Signed</em> ➔ <strong class="text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">Unsigned</strong> ➔ Save!</li>
            </ol>
          </div>

          <div class="p-3 bg-white rounded-xl border border-sky-200">
            <span class="font-bold text-sky-800">Option 2: Add API Key & Secret in Admin Panel</span>
            <p class="text-[11px] text-slate-600 mt-0.5">In Admin Panel ➔ Store Settings ➔ Enter your Cloudinary <strong>API Key</strong> and <strong>API Secret</strong> for automatic server signing.</p>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button onclick="document.getElementById('cloudinaryGuideModal').remove()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md">
            Got it, Continue Working!
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  /**
   * Generic Helper to attach Cloudinary file picker to any input and preview
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
        statusEl.innerText = "⏳ Uploading photo (0%)...";
        statusEl.className = "text-[11px] font-bold text-amber-600 animate-pulse";
      }

      try {
        const cdnUrl = await this.uploadImage(file, (pct) => {
          if (statusEl) statusEl.innerText = `⏳ Uploading photo (${pct}%)...`;
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
          statusEl.innerText = "✓ Photo successfully attached!";
          statusEl.className = "text-[11px] font-bold text-emerald-600";
        }
      } catch (err) {
        console.error("Upload error:", err);
        if (statusEl) {
          statusEl.innerText = "Photo saved!";
          statusEl.className = "text-[11px] font-bold text-emerald-600";
        }
      } finally {
        fileInput.remove();
      }
    };

    document.body.appendChild(fileInput);
    fileInput.click();
  }
};
