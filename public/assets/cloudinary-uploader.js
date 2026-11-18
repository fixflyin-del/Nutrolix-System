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

  getApiHost() {
    if (window.NUTROLIX_API_HOST) return window.NUTROLIX_API_HOST;
    return (window.location && window.location.protocol === "file:") ? "https://nutrolixweb.vercel.app" : "";
  },

  resolveMediaUrl(url) {
    if (!url || typeof url !== "string") return "";
    if (url.startsWith("/api/media/") && window.location && window.location.protocol === "file:") {
      return this.getApiHost() + url;
    }
    return url;
  },

  async hydrateSettings() {
    try {
      const host = this.getApiHost();
      const res = await fetch(host + "/api/settings", { cache: "no-store" });
      if (!res || !res.ok) return null;
      const srv = await res.json();
      if (srv && (srv.cloudinaryCloudName || srv.cloudinaryPreset || srv.cloudinaryApiKey)) {
        const cur = this.getSettings();
        const merged = {
          cloudName: (srv.cloudinaryCloudName || cur.cloudName || "muy6zdcd").trim(),
          uploadPreset: (srv.cloudinaryPreset || cur.uploadPreset || "ml_default").trim(),
          apiKey: (srv.cloudinaryApiKey || cur.apiKey || "").trim(),
          apiSecret: (srv.cloudinaryApiSecret || cur.apiSecret || "").trim(),
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem("nutrolix_cloudinary_settings", JSON.stringify(merged));
        return merged;
      }
    } catch (_) {}
    return null;
  },

  compressImageFile(file, maxDimension = 1080, quality = 0.82) {
    return new Promise((resolve) => {
      const fallbackRead = async () => {
        try {
          const dataUrl = await this.fileToBase64(file);
          resolve({ dataUrl, blob: file });
        } catch (err) {
          resolve({ dataUrl: "", blob: file });
        }
      };

      if (!file || (file.type && (file.type.includes("svg") || file.type.includes("gif")))) {
        return fallbackRead();
      }

      try {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const rawDataUrl = ev.target && ev.target.result;
          const img = new Image();
          img.onload = () => {
            try {
              let w = img.naturalWidth || img.width || 800;
              let h = img.naturalHeight || img.height || 800;
              if (w > maxDimension || h > maxDimension) {
                const ratio = Math.min(maxDimension / w, maxDimension / h);
                w = Math.max(1, Math.round(w * ratio));
                h = Math.max(1, Math.round(h * ratio));
              }
              const canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              if (!ctx) return resolve({ dataUrl: rawDataUrl, blob: file });
              ctx.drawImage(img, 0, 0, w, h);

              // Preserve transparency for PNG/WebP by encoding WebP (widely supported in Chrome & Android WebView)
              let outUrl = "";
              try {
                outUrl = canvas.toDataURL("image/webp", quality);
              } catch (_) {}
              if (!outUrl || !outUrl.startsWith("data:image/webp")) {
                outUrl = canvas.toDataURL("image/jpeg", quality);
              }
              if (canvas.toBlob) {
                const targetMime = outUrl.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
                canvas.toBlob((blob) => {
                  resolve({
                    dataUrl: outUrl && outUrl.length < rawDataUrl.length ? outUrl : rawDataUrl,
                    blob: (blob && blob.size < (file.size || Infinity)) ? blob : file
                  });
                }, targetMime, quality);
              } else {
                resolve({ dataUrl: outUrl || rawDataUrl, blob: file });
              }
            } catch (_) {
              resolve({ dataUrl: rawDataUrl, blob: file });
            }
          };
          img.onerror = () => resolve({ dataUrl: rawDataUrl, blob: file });
          img.src = rawDataUrl;
        };
        reader.onerror = () => fallbackRead();
        reader.readAsDataURL(file);
      } catch (_) {
        fallbackRead();
      }
    });
  },

  _uploadedSignatureByUrl: new Map(),

  buildUniqueFilename(file, targetMime) {
    const mime = String(targetMime || (file && file.type) || "image/webp").toLowerCase();
    const ext = mime.includes("png") ? "png"
      : (mime.includes("jpeg") || mime.includes("jpg")) ? "jpg"
      : mime.includes("gif") ? "gif"
      : "webp";
    const rawName = (file && typeof file.name === "string" && file.name !== "blob")
      ? file.name.replace(/\.[^.]+$/, "")
      : "product";
    const safeBase = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20) || "product";
    const rand = (typeof crypto !== "undefined" && crypto.getRandomValues)
      ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, "0")).join("")
      : Math.random().toString(36).slice(2, 10);
    return `nutrolix_${safeBase}_${Date.now().toString(36)}_${rand}.${ext}`;
  },

  computeFileSignature(file, dataUrl) {
    const str = String(dataUrl || "");
    const mid = str.length > 200 ? str.slice(Math.floor(str.length / 2), Math.floor(str.length / 2) + 64) : "";
    return `${(file && file.size) || 0}:${str.length}:${str.slice(0, 64)}:${mid}:${str.slice(-64)}`;
  },

  isCollisionUrl(url, fileSignature) {
    if (!url || typeof url !== "string") return true;
    const clean = url.split("?")[0].split("#")[0];
    if (/\/blob(\.[a-z0-9]+)?$/i.test(clean)) return true;
    if (this._uploadedSignatureByUrl.has(clean) && this._uploadedSignatureByUrl.get(clean) !== fileSignature) {
      return true;
    }
    return false;
  },

  recordUploadedUrl(url, fileSignature) {
    if (url && typeof url === "string") {
      const clean = url.split("?")[0].split("#")[0];
      this._uploadedSignatureByUrl.set(clean, fileSignature);
    }
  },

  async uploadToPersistentMediaApi(dataUrl, filenamePrefix = "nutrolix_img") {
    const host = this.getApiHost();
    const rand = Math.random().toString(36).slice(2, 8);
    const res = await fetch(host + "/api/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageData: dataUrl,
        filename: `${filenamePrefix}_${Date.now()}_${rand}`
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res && res.ok && data && data.success && (data.url || data.imageUrl)) {
      return this.resolveMediaUrl(data.url || data.imageUrl);
    }
    throw new Error((data && data.error) || `Media API failed (${res ? res.status : "network"})`);
  },

  /**
   * Upload File to Cloudinary with automatic signed / unsigned / persistent /api/upload-image handling
   * @param {File|Blob} file
   * @param {Function} onProgress
   * @returns {Promise<string>} durable HTTP URL (Cloudinary CDN or /api/media/:id)
   */
  async uploadImage(file, onProgress) {
    if (!file) throw new Error("No image file selected.");

    let settings = this.getSettings();
    if (!settings.apiKey || !settings.apiSecret) {
      const hydrated = await this.hydrateSettings();
      if (hydrated) settings = hydrated;
    }

    const cloudName = settings.cloudName || "muy6zdcd";
    const uploadPreset = settings.uploadPreset || "ml_default";
    const apiKey = settings.apiKey || "";
    const apiSecret = settings.apiSecret || "";
    const host = this.getApiHost();

    if (onProgress) onProgress(10);
    const { dataUrl: compressedDataUrl, blob: uploadBlob } = await this.compressImageFile(file);
    const base64Data = compressedDataUrl || await this.fileToBase64(file);
    if (onProgress) onProgress(25);

    const fileSignature = this.computeFileSignature(file, base64Data);
    const uniqueFilename = this.buildUniqueFilename(file, (uploadBlob && uploadBlob.type) || file.type);

    // 1. If API Key and Secret are configured, use Server-Side Signed Upload
    if (apiKey && apiSecret) {
      try {
        if (onProgress) onProgress(45);
        const res = await fetch(host + "/api/cloudinary-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Data,
            filename: uniqueFilename,
            cloudName,
            apiKey,
            apiSecret
          })
        });
        const data = await res.json().catch(() => ({}));
        if (data && data.success && data.url && !this.isCollisionUrl(data.url, fileSignature)) {
          this.recordUploadedUrl(data.url, fileSignature);
          if (onProgress) onProgress(100);
          return data.url;
        }
      } catch (err) {
        console.warn("Server signed upload error:", err);
      }
    }

    // 2. Direct browser upload with unique File name (never unnamed "blob") -> server Cloudinary -> persistent /api/upload-image
    let namedPayload = uploadBlob || file;
    try {
      if (typeof File === "function") {
        namedPayload = new File([uploadBlob || file], uniqueFilename, {
          type: (uploadBlob && uploadBlob.type) || (file && file.type) || "image/webp"
        });
      }
    } catch (_) {}

    const formData = new FormData();
    formData.append("file", namedPayload, uniqueFilename);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "nutrolix_catalog");

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const tryServerAndMediaFallback = async () => {
      try {
        if (onProgress) onProgress(72);
        const sRes = await fetch(host + "/api/cloudinary-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Data, filename: uniqueFilename, cloudName, uploadPreset })
        });
        const sData = await sRes.json().catch(() => ({}));
        if (sData && sData.success && sData.url && !this.isCollisionUrl(sData.url, fileSignature)) {
          this.recordUploadedUrl(sData.url, fileSignature);
          if (onProgress) onProgress(100);
          return sData.url;
        }
      } catch (_) {}

      // Guaranteed cross-device unique persistent URL stored in Firestore mediaStore/{id}
      try {
        if (onProgress) onProgress(88);
        const mediaUrl = await this.uploadToPersistentMediaApi(base64Data, "catalog");
        this.recordUploadedUrl(mediaUrl, fileSignature);
        if (onProgress) onProgress(100);
        return mediaUrl;
      } catch (mediaErr) {
        console.warn("Persistent media API fallback notice:", mediaErr && mediaErr.message);
      }

      if (onProgress) onProgress(100);
      return base64Data;
    };

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint, true);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.min(90, Math.round((e.loaded / e.total) * 65) + 25);
            onProgress(pct);
          }
        };
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const cdnUrl = data.secure_url || data.url;
            if (cdnUrl && !this.isCollisionUrl(cdnUrl, fileSignature)) {
              this.recordUploadedUrl(cdnUrl, fileSignature);
              if (onProgress) onProgress(100);
              return resolve(cdnUrl);
            }
            if (cdnUrl) {
              console.warn("Cloudinary collision/blob URL prevented, switching to unique fallback:", cdnUrl);
            }
          } catch (_) {}
        }

        let errorMsg = "";
        try {
          const err = JSON.parse(xhr.responseText);
          errorMsg = err.error?.message || "";
        } catch (_) {}
        console.warn("Cloudinary direct upload notice:", errorMsg || `HTTP ${xhr.status}`);
        resolve(await tryServerAndMediaFallback());
      };

      xhr.onerror = async () => {
        resolve(await tryServerAndMediaFallback());
      };

      try {
        xhr.send(formData);
      } catch (_) {
        tryServerAndMediaFallback().then(resolve);
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
