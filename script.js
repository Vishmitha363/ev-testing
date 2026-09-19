// ===========================================
// BNC MOTORS PRODUCT VALIDATION REPORT V2
// ===========================================

// ---------- GLOBAL ELEMENTS ----------
const report = document.getElementById("report");

const logoUpload = document.getElementById("logoUpload");
const companyLogo = document.getElementById("companyLogo");

const beforePhoto = document.getElementById("beforePhoto");
const afterPhoto = document.getElementById("afterPhoto");

const beforePreview = document.getElementById("beforePreview");
const afterPreview = document.getElementById("afterPreview");

const beforePlaceholder = document.getElementById("beforePlaceholder");
const afterPlaceholder = document.getElementById("afterPlaceholder");

// All photo slots in Test Photographs.
const PHOTO_IDS = ["before", "after"];

// ---------- THE REPEATED HEADER ----------
// The report has ONE header, at the top of the first page. Every page after
// it carries a read-only copy (headerMirror), so each PDF page is
// identifiable on its own. There used to be a hand-written second copy on a
// fixed page 2; the report is one continuous flow now, so the copies are all
// made the same way and there is only one set of fields to fill in.
const HEADER_FIELDS = ["revision", "reportNo", "reportDate"];

function mirrorHeader() {

    syncHeaderMirrors();     // the copies on every page after the first

}

// The header fields are contenteditable, so mirror on every keystroke.
HEADER_FIELDS.forEach((id) => {

    const el = document.getElementById(id);
    if (el) el.addEventListener("input", mirrorHeader);

});

// ---------- LOGO UPLOAD ----------
logoUpload.addEventListener("change", function () {

    const file = this.files[0];

    // Clear the choice so picking the SAME file again still fires "change".
    this.value = "";

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {

        companyLogo.src = e.target.result;

        bindFreshDraft();
        try { localStorage.setItem("companyLogo", e.target.result); }
        catch (err) { alert("The logo is shown, but it is too large to be saved with the report. Use a smaller image (about 300-600 px wide)."); }

        resetLogoCrop();

    };

    reader.readAsDataURL(file);

});

// ---------- LOGO CROP (drag to pan, scroll to zoom, double-click to reset) ----------

let logoCrop = { scale: 1, x: 0, y: 0 };
let logoCropMode = false;

function applyLogoCrop() {

    const t = "translate(" + logoCrop.x + "px," + logoCrop.y + "px) scale(" + logoCrop.scale + ")";

    companyLogo.style.transformOrigin = "center center";
    companyLogo.style.transform = t;

    if (typeof syncHeaderMirrors === "function") syncHeaderMirrors();

}

function saveLogoCrop() { bindFreshDraft(); localStorage.setItem("logoCrop", JSON.stringify(logoCrop)); }

function resetLogoCrop() { logoCrop = { scale: 1, x: 0, y: 0 }; applyLogoCrop(); saveLogoCrop(); }

function logoCropToggle(btn) {

    logoCropMode = !logoCropMode;
    companyLogo.parentElement.style.cursor = logoCropMode ? "move" : "";
    btn.classList.toggle("tool-active", logoCropMode);

}

function initLogoCrop() {

    const box = companyLogo.parentElement;
    let panning = false, sx = 0, sy = 0, ox = 0, oy = 0;

    box.addEventListener("pointerdown", (e) => {
        // Not on the box's own buttons: capturing the pointer there stole their
        // click, so "⤢ Adjust" could not be switched off and Upload Logo stopped.
        if (!logoCropMode || (e.target.closest && e.target.closest("button, input"))) return;
        panning = true; sx = e.clientX; sy = e.clientY; ox = logoCrop.x; oy = logoCrop.y;
        try { box.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    box.addEventListener("pointermove", (e) => {
        if (!panning) return;
        logoCrop.x = ox + (e.clientX - sx);
        logoCrop.y = oy + (e.clientY - sy);
        applyLogoCrop();
    });

    function end() { if (panning) { panning = false; saveLogoCrop(); } }
    box.addEventListener("pointerup", end);
    box.addEventListener("pointerleave", end);

    box.addEventListener("dblclick", () => { if (logoCropMode) resetLogoCrop(); });

    box.addEventListener("wheel", (e) => {
        if (!logoCropMode) return;
        e.preventDefault();
        const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        logoCrop.scale = Math.min(6, Math.max(0.3, logoCrop.scale * f));
        applyLogoCrop();
        saveLogoCrop();
    }, { passive: false });

}

// ===========================================
// DRAG & DROP UPLOAD
//
// Every upload already works through a hidden <input type="file">. Dropping a
// file hands it to that SAME input and fires "change", so all the existing
// checks (size, type, storage, crop reset) run exactly as they do for a click -
// nothing is duplicated here.
// ===========================================

// Drop zone -> the file input it feeds. Matched with closest() at drop time, so
// photo boxes added later work too.
const DROP_ZONES = [
    { sel: ".upload-area[id$='Area']", input: (z) => z.id.replace(/Area$/, "Photo") },
    { sel: ".logo-box", input: "logoUpload" },
    { sel: ".rca-photos-row, #rcaPhotos", input: "rcaPhotoFile" },
    { sel: ".rca-8d-logo, #rcaLogoBtn", input: "rcaLogoFile" },
    { sel: "#sup8dCard", input: "sup8dFile" },
    { sel: "#tcImgBtn, .cases-form", input: "tcImgFile" },
    { sel: ".ai-input-row, .ai-attach-bar", input: "aiFile" }
];

function dropZoneFor(target) {
    if (!target || !target.closest) return null;
    for (const z of DROP_ZONES) {
        const el = target.closest(z.sel);
        if (!el) continue;
        const id = typeof z.input === "function" ? z.input(el) : z.input;
        const input = document.getElementById(id);
        if (input) return { el: el, input: input };
    }
    return null;
}

// Only the kinds of file that input accepts (an image dropped on the 8D card is
// fine; a PDF dropped on a photo box is not).
function acceptsImagesOnly(input) {
    const accept = String((input && input.accept) || "");
    return /image\/\*/.test(accept) && !/pdf|word|\.doc|text\//i.test(accept);
}

function filesForInput(input, list) {
    const files = Array.prototype.slice.call(list || []);
    const wanted = acceptsImagesOnly(input) ? files.filter((f) => /^image\//.test(f.type)) : files;
    return input.multiple ? wanted : wanted.slice(0, 1);
}

function handOverToInput(input, files) {
    try {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        input.files = dt.files;
    } catch (e) {
        return false;      // very old browser with no DataTransfer: ignore the drop
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

(function initDragDrop() {

    let hot = null;
    const unlight = () => { if (hot) { hot.classList.remove("drop-hot"); hot = null; } };

    // A file dropped anywhere else must NOT open in the browser - that would
    // navigate away from the report and lose whatever is not saved.
    document.addEventListener("dragover", (e) => {
        if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") < 0) return;
        e.preventDefault();
        const zone = dropZoneFor(e.target);
        if (zone) {
            e.dataTransfer.dropEffect = "copy";
            if (hot !== zone.el) { unlight(); hot = zone.el; hot.classList.add("drop-hot"); }
        } else {
            e.dataTransfer.dropEffect = "none";
            unlight();
        }
    });

    document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) unlight(); });

    document.addEventListener("drop", (e) => {
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) { unlight(); return; }
        e.preventDefault();                 // always: never let the browser open the file
        const zone = dropZoneFor(e.target);
        unlight();
        if (!zone) return;
        const files = filesForInput(zone.input, e.dataTransfer.files);

        // Everything dropped was the wrong kind for this place. Returning in
        // silence looked exactly like a broken drop zone - a datasheet dropped
        // on the Test Cases card simply vanished, with no message, no highlight
        // and no browser fallback (the drop is preventDefault-ed above).
        if (!files.length) {
            alert(acceptsImagesOnly(zone.input)
                ? "Only pictures can be dropped here - JPG, PNG or similar."
                : "That kind of file cannot be used here.");
            return;
        }

        handOverToInput(zone.input, files);
    });

})();

// ===========================================
// PHOTO IMPORT
//
// One pipeline for every way a picture arrives - the Photo button, a drop, or a
// paste. A phone photo is turned the right way up by its own orientation tag and
// scaled down to a sane size, so the draft and the PDF stay small. There used to
// be three near-identical readers (Before / After / added photos) that could
// drift apart; they all call setPhotoImage() now.
// ===========================================

const PHOTO_MAX_PX = 2000;      // longest edge kept; 2000px still prints sharply

// File/Blob -> upright, right-sized data URL.
async function prepareImage(file) {

    const plain = () => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });

    let bmp = null;
    try {
        // "from-image" applies the EXIF orientation, so sideways photos land upright.
        bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
        try { bmp = await createImageBitmap(file); } catch (e2) { bmp = null; }
    }
    if (!bmp) return plain();                    // very old browser: use it as it is

    try {
        const big = Math.max(bmp.width, bmp.height);
        const k = big > PHOTO_MAX_PX ? PHOTO_MAX_PX / big : 1;
        const w = Math.max(1, Math.round(bmp.width * k));
        const h = Math.max(1, Math.round(bmp.height * k));

        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(bmp, 0, 0, w, h);

        // PNG for small screenshots (crisp text), JPEG for photographs (much smaller).
        const png = /png/i.test(file.type || "") && w * h <= 1400 * 1400;
        const url = c.toDataURL(png ? "image/png" : "image/jpeg", 0.92);
        return url;
    } finally {
        if (bmp.close) bmp.close();
    }
}

// Puts a prepared picture into a photo box: preview, placeholder, draft copy,
// and a clean slate for the marks belonging to the previous photo.
function setPhotoImage(id, dataUrl, keepMarks) {

    const pv = document.getElementById(id + "Preview");
    const ph = document.getElementById(id + "Placeholder");
    if (!pv) return;

    pv.src = dataUrl;
    pv.style.display = "block";
    if (ph) ph.style.display = "none";

    storePhoto(id + "Photo", dataUrl);

    if (!keepMarks) photoClear(id);

    // The framing must be worked out from the NEW picture. Resetting before it
    // has decoded left the previous zoom in place, so a photo dropped in after a
    // crop came up wrongly enlarged.
    resetCrop(id);
    const reframe = () => { resetCrop(id); pv.removeEventListener("load", reframe); };
    pv.addEventListener("load", reframe);

    applyPhotoGray(id);

    if (typeof checkPageFit === "function") checkPageFit();
}

// The one route every picture takes.
async function importIntoPhoto(id, file) {
    // A photo landing while the PDF is captured reflows the pages between page
    // captures, so the PDF could drop or repeat a section.
    if (pdfBuilding || pdfStraggler) { alert("Please wait - the PDF is still being made. Add the photo when it has finished."); return; }
    try {
        const url = await prepareImage(file);
        if (url && (pdfBuilding || pdfStraggler)) { alert("The PDF started while the photo was being prepared - add the photo again when it has finished."); return; }
        if (url) setPhotoImage(id, url);
    } catch (e) {
        alert("That image could not be read. Try a different file.");
    }
}

function setupPhotoInput(id) {
    const input = document.getElementById(id + "Photo");
    if (!input) return;
    input.addEventListener("change", function () {
        const file = this.files[0];
        this.value = "";          // picking the same file again must still work
        if (file) importIntoPhoto(id, file);
    });
}

setupPhotoInput("before");
setupPhotoInput("after");

// ---------- ROTATE (90° clockwise, baked into the picture) ----------
// Baked rather than a CSS transform: the stored image is then already upright
// everywhere - screen, PDF, Word - with no extra state to keep in step.
function rotatePhoto(id) {

    const pv = document.getElementById(id + "Preview");
    if (!pv || !pv.src || pv.style.display === "none") return;

    const im = new Image();
    im.onload = () => {
        const c = document.createElement("canvas");
        c.width = im.naturalHeight;
        c.height = im.naturalWidth;
        const g = c.getContext("2d");
        g.translate(c.width / 2, c.height / 2);
        g.rotate(Math.PI / 2);
        g.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
        // The marks stay as they are (they belong to the box, not the picture);
        // only the framing is reset, because the shape of the photo changed.
        setPhotoImage(id, c.toDataURL("image/jpeg", 0.92), true);
    };
    im.onerror = () => { /* nothing to rotate */ };
    im.src = pv.src;
}

// ---------- PASTE A SCREENSHOT ----------
// The picture goes into the photo box you last clicked. Pasting while typing in
// a report field is left alone - that must still paste text.
let lastPhotoId = null;

function photoIdFromNode(node) {
    const box = node && node.closest ? node.closest(".photo-box") : null;
    if (!box) return null;
    const area = box.querySelector(".upload-area[id$='Area']");
    return area ? area.id.replace(/Area$/, "") : null;
}

document.addEventListener("pointerdown", (e) => {
    const id = photoIdFromNode(e.target);
    if (id) lastPhotoId = id;
}, true);

document.addEventListener("paste", (e) => {

    const cd = e.clipboardData;
    if (!cd) return;

    const file = Array.prototype.slice.call(cd.files || []).find((f) => /^image\//.test(f.type));
    if (!file) return;

    const el = document.activeElement;
    if (el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;

    // The box you last clicked, else the first empty one.
    let id = lastPhotoId;
    if (!id) {
        const empty = Array.prototype.find.call(
            document.querySelectorAll("#report .photo-box .upload-area[id$='Area']"),
            (a) => { const p = document.getElementById(a.id.replace(/Area$/, "") + "Preview"); return p && (!p.src || p.style.display === "none"); });
        id = empty ? empty.id.replace(/Area$/, "") : null;
    }
    if (!id) return;

    e.preventDefault();
    importIntoPhoto(id, file);
});

// ---------- EXTRA PHOTO SLOTS (photo3, photo4) ----------
function setupPhotoUpload(id) {
    setupPhotoInput(id);
}

// Keep a photo with the report. When the browser storage is full the photo
// still shows, and the user is told it will not be kept (this used to fail
// silently, and the marks were not cleared either).
// ---------- ONE DRAFT AT A TIME ----------
// The app opens BLANK while the last draft stays in storage for "Load Draft".
// Anything done on the blank screen used to be written INTO that old draft
// piece by piece: a new photo came up grey because the old photo was, an added
// photo box reused the old "extra1" data, and Load Draft later mixed old text
// with new photos. Now the first change on a blank screen starts a fresh draft
// (the old one is replaced, exactly as typing already replaced its text).
let draftBound = false;     // true once the screen and the stored draft are the same report
let appStarted = false;     // set at the end of start-up; nothing before that is a user change

function bindFreshDraft() {
    if (draftBound || !appStarted) return;
    draftBound = true;
    try {
        const drop = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k !== SAVED_KEY && NON_REPORT_KEYS.indexOf(k) < 0) drop.push(k);
        }
        drop.forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* storage unavailable - nothing to separate */ }
    // The per-photo caches were read from the OLD draft's keys.
    [photoGray, photoInside].forEach((store) => Object.keys(store).forEach((k) => { delete store[k]; }));
    PHOTO_IDS.concat(Array.prototype.map.call(document.querySelectorAll("#extraPhotos .photo-box[data-extra]"),
        (b) => b.getAttribute("data-extra"))).forEach((id) => {
        const g = document.getElementById(id + "Gray");
        if (g) { photoGray[id] = g.checked; if (g.checked) try { localStorage.setItem(id + "Gray", "1"); } catch (e) { /* ignore */ } }
        const ins = document.getElementById(id + "Inside");
        if (ins) { photoInside[id] = ins.checked; if (!ins.checked) try { localStorage.setItem(id + "Inside", "0"); } catch (e) { /* ignore */ } }
    });
}

function storePhoto(key, dataUrl) {

    bindFreshDraft();

    try {
        localStorage.setItem(key, dataUrl);
    } catch (err) {
        alert("The photo is shown, but the browser storage is full, so it will not be kept with the draft. " +
            "Use a smaller photo, or delete old saved reports in My Reports.");
    }

}

setupPhotoUpload("photo3");
setupPhotoUpload("photo4");

// ---------- RESTORE SAVED IMAGES ----------
// Called from loadDraft only. Restoring these on page load made a fresh
// report open with the previous report's photographs already in it.
function loadSavedImages() {

    const logo = localStorage.getItem("companyLogo");

    if (logo) {

        companyLogo.src = logo;


        const lc = localStorage.getItem("logoCrop"); if (lc) { try { logoCrop = JSON.parse(lc); } catch (e) { } applyLogoCrop(); }

    }

    const before = localStorage.getItem("beforePhoto");

    if (before) {

        beforePreview.src = before;

        beforePreview.style.display = "block";

        beforePlaceholder.style.display = "none";

    }

    const after = localStorage.getItem("afterPhoto");

    if (after) {

        afterPreview.src = after;

        afterPreview.style.display = "block";

        afterPlaceholder.style.display = "none";

    }

    // Restore photos, then circles/arrows and crop for every slot.
    PHOTO_IDS.forEach((id) => {

        const savedImg = localStorage.getItem(id + "Photo");

        if (savedImg) {
            const pv = document.getElementById(id + "Preview");
            pv.src = savedImg; pv.style.display = "block";
            document.getElementById(id + "Placeholder").style.display = "none";
        }


        const saved = localStorage.getItem(id + "Annot");

        if (saved !== null) {

            try { photoShapes[id] = JSON.parse(saved) || []; }
            catch (e) { photoShapes[id] = []; }

            redrawPhoto(id);

        }

        const savedCrop = localStorage.getItem(id + "Crop");

        if (savedCrop !== null) {

            try { photoCrop[id] = JSON.parse(savedCrop); } catch (e) { /* keep default */ }

            applyCrop(id);

            // The picture comes back straightened; the slider must say so, or the
            // next nudge snapped a 10° photo to 0.5°.
            const sl = document.getElementById(id + "Straighten");
            if (sl && photoCrop[id]) sl.value = photoCrop[id].rot || 0;

        }

        // Grey-for-printing and keep-marks-inside are part of the photo too.
        applyPhotoGray(id);
        const insideBox = document.getElementById(id + "Inside");
        if (insideBox) insideBox.checked = marksInside(id);

        const savedLabels = localStorage.getItem(id + "Labels");

        if (savedLabels !== null) {

            try { photoLabels[id] = JSON.parse(savedLabels) || []; }
            catch (e) { photoLabels[id] = []; }

        }

        renderPhotoLabels(id);

    });

}

// ===========================================
// PHOTO ANNOTATION  (draw circles and arrows on the photos)
//
// A transparent <canvas> sits over each photo. When a drawing tool is active
// it captures the mouse and records a red circle or arrow; with no tool active
// it ignores clicks, so "Click to upload" still works. Shapes are stored as
// simple coordinates (in an 800x300 space) so they can be saved, undone, and
// re-drawn. Canvas is used instead of SVG because html2canvas renders a canvas
// reliably into the exported PDF, whereas an SVG overlay does not.
// ===========================================

const ANNOT_COLOR = "#e11d1d";        // circles and arrows
const ANNOT_TEXT_COLOR = "#000000";   // labels - black
const ANNOT_W = 800;   // the coordinate space marks are stored in
const ANNOT_H = 300;
// The bitmap is drawn at this multiple of that space, so lines stay crisp in the
// PDF. The COORDINATES are untouched - every mark already saved stays put.
const ANNOT_SCALE = 3;
const ANNOT_LINE = 2.4;               // mark line weight, in the 800x300 space

// Which mark is selected per photo: an index into photoShapes[id], or -1.
const photoSel = {};
// Keep marks on the photo (on by default) instead of letting them dangle in the
// white space around it.
const photoInside = {};

function marksInside(id) {
    if (id in photoInside) return photoInside[id];
    let v = true;
    try { v = localStorage.getItem(id + "Inside") !== "0"; } catch (e) { /* default */ }
    photoInside[id] = v;
    return v;
}

function setMarksInside(id, on) {
    bindFreshDraft();
    photoInside[id] = !!on;
    try { localStorage.setItem(id + "Inside", on ? "1" : "0"); } catch (e) { /* ignore */ }
    if (on) {
        (photoShapes[id] || []).forEach((s) => clampShape(id, s));
        redrawPhoto(id);
        savePhotoAnnot(id);
    }
}

// The part of the canvas that is actually over the photo, in mark coordinates.
// (The canvas deliberately reaches past the photo so marks CAN go outside.)
function photoInsideBox(id) {
    const canvas = photoCanvas(id);
    const area = document.getElementById(id + "Area");
    if (!canvas || !area) return { x0: 0, y0: 0, x1: ANNOT_W, y1: ANNOT_H };
    const c = canvas.getBoundingClientRect(), a = area.getBoundingClientRect();
    if (!c.width || !c.height) return { x0: 0, y0: 0, x1: ANNOT_W, y1: ANNOT_H };
    return {
        x0: ((a.left - c.left) / c.width) * ANNOT_W,
        y0: ((a.top - c.top) / c.height) * ANNOT_H,
        x1: ((a.right - c.left) / c.width) * ANNOT_W,
        y1: ((a.bottom - c.top) / c.height) * ANNOT_H
    };
}

function clampShape(id, s) {
    if (!s || !marksInside(id)) return s;
    const b = photoInsideBox(id);
    const cx = (v) => Math.max(b.x0, Math.min(v, b.x1));
    const cy = (v) => Math.max(b.y0, Math.min(v, b.y1));
    if (s.type === "text") { s.x = cx(s.x); s.y = cy(s.y); return s; }
    s.x1 = cx(s.x1); s.x2 = cx(s.x2);
    s.y1 = cy(s.y1); s.y2 = cy(s.y2);
    return s;
}

// Which mark is under this point (topmost first). Returns an index, or -1.
function shapeAt(id, x, y) {
    const list = photoShapes[id] || [];
    const tol = 12;
    for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        if (s.type === "text") {
            if (x >= s.x - 10 && x <= s.x + (String(s.text).length * 16 + 20) && y >= s.y - 10 && y <= s.y + 40) return i;
            continue;
        }
        const lo = { x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2) };
        const hi = { x: Math.max(s.x1, s.x2), y: Math.max(s.y1, s.y2) };
        if (s.type === "arrow") {
            // distance from the line
            const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
            const len2 = dx * dx + dy * dy;
            const t = len2 ? Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / len2)) : 0;
            const px = s.x1 + t * dx, py = s.y1 + t * dy;
            if (Math.hypot(x - px, y - py) <= tol) return i;
            continue;
        }
        if (x >= lo.x - tol && x <= hi.x + tol && y >= lo.y - tol && y <= hi.y + tol) return i;
    }
    return -1;
}

// The four corner handles of the selected mark.
function shapeHandles(s) {
    if (!s || s.type === "text") return [];
    return [
        { k: "tl", x: s.x1, y: s.y1 }, { k: "tr", x: s.x2, y: s.y1 },
        { k: "bl", x: s.x1, y: s.y2 }, { k: "br", x: s.x2, y: s.y2 }
    ];
}

function handleAt(id, x, y) {
    const i = photoSel[id];
    const s = (photoShapes[id] || [])[i == null ? -1 : i];
    if (!s) return null;
    const hit = shapeHandles(s).find((h) => Math.abs(x - h.x) <= 14 && Math.abs(y - h.y) <= 14);
    return hit ? hit.k : null;
}

function selectShape(id, i) {
    // ONE selection in the whole report. Two photos could each hold a selection,
    // so both showed dashed handles and the Delete key acted on whichever came
    // first in the object - deleting a mark on the OTHER photo.
    Object.keys(photoSel).forEach((other) => {
        if (other === id) return;
        if (photoSel[other] != null && photoSel[other] >= 0) {
            photoSel[other] = -1;
            redrawPhoto(other);
        }
    });
    photoSel[id] = i;
    redrawPhoto(id);
}

// Removes just the selected mark - Undo only ever removed the newest one.
function deleteSelectedMark(id) {
    const i = photoSel[id];
    if (i == null || i < 0 || !photoShapes[id] || !photoShapes[id][i]) return false;
    photoShapes[id].splice(i, 1);
    photoSel[id] = -1;
    redrawPhoto(id);
    savePhotoAnnot(id);
    return true;
}

// Delete / Backspace removes the selected mark; Escape lets it go.
document.addEventListener("keydown", (e) => {
    const el = document.activeElement;
    if (el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
    const id = Object.keys(photoSel).find((k) => photoSel[k] != null && photoSel[k] >= 0);
    if (!id) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelectedMark(id); }
    else if (e.key === "Escape") { photoSel[id] = -1; redrawPhoto(id); }
});

// Which tool is active per photo (null / "circle" / "arrow").
const photoActiveTool = { before: null, after: null };

// The drawn shapes per photo: {type, x1, y1, x2, y2} in 800x300 coordinates.
const photoShapes = { before: [], after: [] };

// Free text labels per photo. These are real DOM elements (not drawn on the
// canvas) so they can be dragged anywhere on the box - including OUTSIDE the
// image, over the captions or the margins. {x, y} are pixels from the top-left
// of the photo box. Text is plain black Times New Roman.
const photoLabels = { before: [], after: [] };

// Shared insertion counter so "Undo" can remove the single most-recent thing,
// whether it was a drawn shape (circle/arrow) or a text label.
let annotSeq = 0;

function photoCanvas(id) {

    return document.getElementById(id + "Annot");

}

function photoUploadClick(id) {

    document.getElementById(id + "Photo").click();

}

function savePhotoAnnot(id) {
    bindFreshDraft();

    // Storage full must not break the drawing flow (the mark is already on the
    // canvas); warn once, like storePhoto does for the photo itself.
    try { localStorage.setItem(id + "Annot", JSON.stringify(photoShapes[id])); }
    catch (e) { warnStorageFull("the marks on this photo"); }

}

// True while the report is being turned into the PDF - selection marks must not
// be drawn into it.
function reportIsExporting() {
    const r = document.getElementById("report");
    return !!(r && r.classList.contains("exporting"));
}

// ---------- GREY FOR PRINTING ----------
// The photo is kept in COLOUR; grey is only how it is shown and exported, so the
// choice can be undone at any time. On screen a CSS filter does it - but the PDF
// capture ignores filters (measured), so the export swaps in a grey copy and puts
// the colour one back afterwards.
const photoGray = {};

function photoIsGray(id) {
    if (id in photoGray) return photoGray[id];
    let v = false;
    try { v = localStorage.getItem(id + "Gray") === "1"; } catch (e) { /* default */ }
    photoGray[id] = v;
    return v;
}

function applyPhotoGray(id) {
    const img = document.getElementById(id + "Preview");
    if (img) img.style.filter = photoIsGray(id) ? "grayscale(1)" : "";
    const box = document.getElementById(id + "Gray");
    if (box) box.checked = photoIsGray(id);
}

function setPhotoGray(id, on) {
    bindFreshDraft();
    photoGray[id] = !!on;
    try { localStorage.setItem(id + "Gray", on ? "1" : "0"); } catch (e) { /* ignore */ }
    applyPhotoGray(id);
}

// A grey copy of one photo, for the capture only.
function greyCopy(src) {
    return new Promise((resolve) => {
        const im = new Image();
        im.onload = () => {
            try {
                const c = document.createElement("canvas");
                c.width = im.naturalWidth; c.height = im.naturalHeight;
                const g = c.getContext("2d");
                g.drawImage(im, 0, 0);
                const d = g.getImageData(0, 0, c.width, c.height);
                const p = d.data;
                for (let i = 0; i < p.length; i += 4) {
                    // Rec. 601 luma - what a mono printer would make of it.
                    const y = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0;
                    p[i] = p[i + 1] = p[i + 2] = y;
                }
                g.putImageData(d, 0, 0);
                resolve(c.toDataURL("image/jpeg", 0.92));
            } catch (e) { resolve(null); }
        };
        im.onerror = () => resolve(null);
        im.src = src;
    });
}

// Swap grey copies in for the capture. Returns a function that puts the colour
// pictures back - always call it, even if the export fails.
async function greyPhotosForExport() {

    const swapped = [];

    const imgs = Array.prototype.slice.call(document.querySelectorAll("#report .upload-area img"));

    for (const img of imgs) {
        const id = (img.id || "").replace(/Preview$/, "");
        if (!id || !photoIsGray(id) || !img.src || img.style.display === "none") continue;
        const grey = await greyCopy(img.src);
        if (!grey) continue;
        swapped.push({ img: img, colour: img.src, filter: img.style.filter });
        img.style.filter = "";          // the filter is ignored by the capture anyway
        img.src = grey;
        await new Promise((r) => { if (img.complete) r(); else { img.onload = r; img.onerror = r; } });
        // A zoom box is drawn from the picture's pixels: redraw it from the grey copy.
        redrawPhoto(id);
    }

    return function restore() {
        swapped.forEach((s) => {
            s.img.src = s.colour; s.img.style.filter = s.filter;
            const id = (s.img.id || "").replace(/Preview$/, "");
            const again = () => redrawPhoto(id);
            if (s.img.complete) again(); else s.img.addEventListener("load", again, { once: true });
        });
    };

}

function redrawPhoto(id) {

    const canvas = photoCanvas(id);

    // The box may be GONE while something still points at it - a removed photo,
    // or New Report clearing them - and hideScreenOnly() redraws every photo
    // that has a selection. Without this guard that threw a TypeError BEFORE
    // the export's try block, so the restore never ran: the report was left
    // inert with every toolbar hidden, pdfBuilding stuck true (silently killing
    // all later exports AND the autosave) until the page was reloaded.
    if (!canvas || !photoShapes[id]) return;

    const ctx = canvas.getContext("2d");

    // Draw at ANNOT_SCALE times the mark coordinates, so the lines are made of
    // enough pixels to stay sharp in the PDF, while the coordinates stay the same.
    if (canvas.width !== ANNOT_W * ANNOT_SCALE) {
        canvas.width = ANNOT_W * ANNOT_SCALE;
        canvas.height = ANNOT_H * ANNOT_SCALE;
    }
    ctx.setTransform(ANNOT_SCALE, 0, 0, ANNOT_SCALE, 0, 0);
    ctx.clearRect(0, 0, ANNOT_W, ANNOT_H);

    photoShapes[id].forEach((s, idx) => {

        if (s.type === "circle") {

            ctx.strokeStyle = ANNOT_COLOR;
            ctx.lineWidth = ANNOT_LINE;

            ctx.beginPath();

            ctx.ellipse(
                (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2,
                Math.abs(s.x2 - s.x1) / 2, Math.abs(s.y2 - s.y1) / 2,
                0, 0, Math.PI * 2);

            ctx.stroke();

        } else if (s.type === "arrow") {

            ctx.strokeStyle = ANNOT_COLOR;
            ctx.fillStyle = ANNOT_COLOR;
            ctx.lineWidth = ANNOT_LINE;

            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();

            const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
            const hl = 15;

            ctx.beginPath();
            ctx.moveTo(s.x2, s.y2);
            ctx.lineTo(s.x2 - hl * Math.cos(ang - Math.PI / 7), s.y2 - hl * Math.sin(ang - Math.PI / 7));
            ctx.lineTo(s.x2 - hl * Math.cos(ang + Math.PI / 7), s.y2 - hl * Math.sin(ang + Math.PI / 7));
            ctx.closePath();
            ctx.fill();

        } else if (s.type === "inset") {

            drawInset(id, ctx, s);

        } else if (s.type === "text") {

            // Black label in normal Times New Roman with a thin white halo so
            // it stays readable on any photo. The fill is drawn last.
            ctx.font = "30px 'Times New Roman', Times, serif";
            ctx.textBaseline = "top";
            ctx.lineJoin = "round";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#ffffff";
            ctx.strokeText(s.text, s.x, s.y);
            ctx.fillStyle = ANNOT_TEXT_COLOR;
            ctx.fillText(s.text, s.x, s.y);

        }

        // The selected mark gets a dashed box and corner handles (screen only -
        // the selection is dropped before the report is captured).
        if (photoSel[id] === idx && !reportIsExporting()) {

            const lo = { x: Math.min(s.x1 == null ? s.x : s.x1, s.x2 == null ? s.x : s.x2),
                         y: Math.min(s.y1 == null ? s.y : s.y1, s.y2 == null ? s.y : s.y2) };
            const hi = { x: Math.max(s.x1 == null ? s.x + 120 : s.x1, s.x2 == null ? s.x + 120 : s.x2),
                         y: Math.max(s.y1 == null ? s.y + 34 : s.y1, s.y2 == null ? s.y + 34 : s.y2) };

            ctx.save();
            ctx.strokeStyle = "#0F4C81";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(lo.x - 6, lo.y - 6, (hi.x - lo.x) + 12, (hi.y - lo.y) + 12);
            ctx.setLineDash([]);
            ctx.fillStyle = "#ffffff";
            shapeHandles(s).forEach((h) => {
                ctx.fillRect(h.x - 5, h.y - 5, 10, 10);
                ctx.strokeRect(h.x - 5, h.y - 5, 10, 10);
            });
            ctx.restore();

        }

    });

}

// Finds a text label near the given point (for dragging / clicking).
function textAt(id, x, y) {

    // Search topmost first.
    for (let i = photoShapes[id].length - 1; i >= 0; i--) {

        const s = photoShapes[id][i];

        if (s.type === "text" &&
            x >= s.x - 10 && x <= s.x + (s.text.length * 16 + 20) &&
            y >= s.y - 10 && y <= s.y + 40) {

            return s;

        }

    }

    return null;

}

// Every OTHER photo: tool, Pan and Crop off, and its toolbar highlight cleared.
// Pan and Crop used to switch only their own photo, so a drawing tool armed on
// another photo stayed live (and highlighted) with its canvas still on top.
function disarmOtherPhotos(id) {
    const ids = new Set(Object.keys(photoActiveTool)
        .concat(Object.keys(photoCropMode), Object.keys(photoRectMode)));
    ids.forEach((other) => {
        if (other === id) return;
        if (photoActiveTool[other]) {
            photoActiveTool[other] = null;
            const oc = photoCanvas(other);
            if (oc) { oc.style.pointerEvents = "none"; oc.style.cursor = ""; oc.style.zIndex = ""; }
        }
        if (photoCropMode[other] || photoRectMode[other]) {
            photoCropMode[other] = false;
            photoRectMode[other] = false;
            const oa = document.getElementById(other + "Area");
            if (oa) oa.style.cursor = "";
        }
        const obox = document.getElementById(other + "Area");
        const tb = obox && obox.closest(".photo-box");
        if (tb) tb.querySelectorAll(".photo-toolbar .tool-active").forEach((b) => b.classList.remove("tool-active"));
    });
}

function photoTool(id, tool, btn) {

    const active = photoActiveTool[id] === tool ? null : tool;

    // Turn off any OTHER photo's active tool and drop its raised z-index, so two
    // overlapping (enlarged) canvases can never fight over the same click.
    Object.keys(photoActiveTool).forEach((other) => {
        if (other === id) return;
        if (photoActiveTool[other]) {
            photoActiveTool[other] = null;
            const oc = photoCanvas(other);
            if (oc) { oc.style.pointerEvents = "none"; oc.style.cursor = ""; oc.style.zIndex = ""; }
        }
        // ...and their Pan / Crop modes too. Only the BUTTON highlights were
        // cleared below, so the other photo stayed armed for panning with
        // nothing to show it - and its Pan button then needed two clicks.
        if (photoCropMode[other] || photoRectMode[other]) {
            photoCropMode[other] = false;
            photoRectMode[other] = false;
            const oa = document.getElementById(other + "Area");
            if (oa) oa.style.cursor = "";
        }
    });
    document.querySelectorAll(".photo-toolbar .tool-active").forEach((b) => {
        if (b !== btn) b.classList.remove("tool-active");
    });

    photoActiveTool[id] = active;

    // Picking a drawing tool ends crop mode. Only the Crop button's highlight
    // used to go, so the next Crop click turned crop OFF instead of on.
    // photoRectMode was never cleared here either, which left the rectangle
    // crop armed underneath a drawing tool.
    if (active && (photoCropMode[id] || photoRectMode[id])) {
        photoCropMode[id] = false;
        photoRectMode[id] = false;
        const area = document.getElementById(id + "Area");
        if (area) area.style.cursor = "";
    }

    const canvas = photoCanvas(id);

    // Only capture the mouse while a tool is on, so uploads still work.
    canvas.style.pointerEvents = active ? "auto" : "none";

    canvas.style.cursor = active ? (active === "select" ? "default" : "crosshair") : "";

    // Switching tools drops any selection, so its handles do not linger.
    if (active !== "select") { photoSel[id] = -1; redrawPhoto(id); }

    // While drawing, lift this canvas above everything (neighbouring photo
    // canvases, adjacent sections) so the drag always lands on THIS photo,
    // even out in the margin where boxes overlap.
    canvas.style.zIndex = active ? "50" : "";

    btn.parentElement.querySelectorAll("button").forEach((b) => {

        b.classList.remove("tool-active");

    });

    if (active) btn.classList.add("tool-active");

}

function photoUndo(id) {

    // Remove whichever was added last: a drawn shape or a text label.
    const shapes = photoShapes[id] || [];
    const labels = photoLabels[id] || [];

    const s = shapes[shapes.length - 1];
    const l = labels[labels.length - 1];

    if (!s && !l) return;

    const sSeq = s ? (s._seq || 0) : -1;
    const lSeq = l ? (l._seq || 0) : -1;

    if (l && lSeq >= sSeq) {

        labels.pop();
        renderPhotoLabels(id);
        savePhotoLabels(id);

    } else {

        shapes.pop();
        redrawPhoto(id);
        savePhotoAnnot(id);

    }

}

// Clear removes every mark on the photo - circles, arrows AND text labels
// (labels used to stay behind, also on a newly uploaded photo).
function photoClear(id) {

    photoShapes[id] = [];

    // The selection pointed into the array just emptied. Left behind, it made
    // Delete act on this photo instead of the one the user was working in.
    photoSel[id] = -1;

    redrawPhoto(id);

    savePhotoAnnot(id);

    photoLabels[id] = [];

    renderPhotoLabels(id);

    try { savePhotoLabels(id); } catch (e) { /* storage full - nothing to keep */ }

}

// ---------- FREE TEXT LABELS (draggable, can sit outside the image) ----------

function labelLayer(id) {
    return document.getElementById(id + "Labels");
}

function savePhotoLabels(id) {
    bindFreshDraft();
    try { localStorage.setItem(id + "Labels", JSON.stringify(photoLabels[id] || [])); }
    catch (e) { warnStorageFull("the labels on this photo"); }
}

// Rebuilds the label DOM for one photo from photoLabels[id].
function renderPhotoLabels(id) {

    const layer = labelLayer(id);
    if (!layer) return;

    layer.innerHTML = "";

    (photoLabels[id] || []).forEach((lb) => {

        const el = document.createElement("div");
        el.className = "photo-label";
        el.textContent = lb.text;
        el.style.left = lb.x + "px";
        el.style.top = lb.y + "px";

        makeLabelDraggable(id, el, lb);

        layer.appendChild(el);

    });
}

// Adds a new label. It appears near the middle of the box and can then be
// dragged anywhere - onto the photo or off it into the surrounding area.
function addPhotoLabel(id) {

    const text = prompt("Label text:");
    if (text === null) return;

    const t = text.trim();
    if (!t) return;

    if (!photoLabels[id]) photoLabels[id] = [];

    const layer = labelLayer(id);
    const W = layer ? layer.clientWidth : 200;
    const H = layer ? layer.clientHeight : 180;

    photoLabels[id].push({ x: Math.round(W * 0.28), y: Math.round(H * 0.45), text: t, _seq: ++annotSeq });

    renderPhotoLabels(id);
    savePhotoLabels(id);

}

// Drag to move; double-click to edit the text (empty text deletes it).
function makeLabelDraggable(id, el, lb) {

    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;

    el.addEventListener("pointerdown", (e) => {

        dragging = true;
        moved = false;
        sx = e.clientX; sy = e.clientY;
        ox = lb.x; oy = lb.y;

        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

        e.preventDefault();
        e.stopPropagation();

    });

    el.addEventListener("pointermove", (e) => {

        if (!dragging) return;

        moved = true;

        const layer = el.parentElement;
        const W = layer.clientWidth, H = layer.clientHeight;

        let nx = ox + (e.clientX - sx);
        let ny = oy + (e.clientY - sy);

        // Allow the label to be dragged well OUTSIDE the box (into the margins
        // around the photo), while still clamping enough that it can't be lost
        // far off the page.
        nx = Math.max(-70, Math.min(nx, W + 70));
        ny = Math.max(-60, Math.min(ny, H + 80));

        lb.x = nx; lb.y = ny;
        el.style.left = nx + "px";
        el.style.top = ny + "px";

    });

    el.addEventListener("pointerup", () => {
        if (dragging) { dragging = false; savePhotoLabels(id); }
    });

    el.addEventListener("dblclick", (e) => {

        e.preventDefault();
        e.stopPropagation();

        const nt = prompt("Edit label (leave empty to delete):", lb.text);
        if (nt === null) return;

        if (!nt.trim()) {
            const i = photoLabels[id].indexOf(lb);
            if (i >= 0) photoLabels[id].splice(i, 1);
        } else {
            lb.text = nt.trim();
        }

        renderPhotoLabels(id);
        savePhotoLabels(id);

    });
}

// ---------- PHOTO CROP (drag to pan, scroll to zoom, double-click to reset) ----------

const photoCrop = { before: { scale: 1, x: 0, y: 0 }, after: { scale: 1, x: 0, y: 0 } };
const photoCropMode = { before: false, after: false };

// How the photo sits in its box. The picture is drawn "cover" by CSS, so scale 1
// = filling the box; everything below is expressed against that.
function photoFrame(id) {
    const img = document.getElementById(id + "Preview");
    const area = document.getElementById(id + "Area");
    if (!img || !area || !img.naturalWidth) return null;
    const r = area.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
        w: r.width, h: r.height, nw: img.naturalWidth, nh: img.naturalHeight,
        cover: Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight),
        contain: Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight)
    };
}

// Straightening rotates the picture, which would show white corners - zoom just
// enough to keep the box covered.
function straightenCover(id, rot) {
    const f = photoFrame(id);
    if (!f || !rot) return 1;
    const t = Math.abs(rot) * Math.PI / 180;
    const cos = Math.abs(Math.cos(t)), sin = Math.abs(Math.sin(t));
    return Math.max((f.w * cos + f.h * sin) / f.w, (f.w * sin + f.h * cos) / f.h);
}

function applyCrop(id) {

    const img = document.getElementById(id + "Preview");
    const c = photoCrop[id];
    if (!img || !c) return;

    const rot = c.rot || 0;
    const k = straightenCover(id, rot);

    img.style.transformOrigin = "center center";
    img.style.transform = "translate(" + c.x + "px," + c.y + "px) rotate(" + rot + "deg) scale(" + ((c.scale || 1) * k) + ")";

    photoZoomLabel(id);

    // A zoom box copies part of the picture, so moving / zooming / rotating the
    // picture must refresh it (it kept showing the old region).
    if ((photoShapes[id] || []).some((s) => s.type === "inset")) redrawPhoto(id);

}

// The readout shows TRUE size: 100% = one pixel of the photo per pixel on screen.
function photoZoomLabel(id) {
    const el = document.getElementById(id + "Zoom");
    if (!el) return;
    const f = photoFrame(id);
    el.textContent = f ? Math.round(f.cover * ((photoCrop[id] || {}).scale || 1) * 100) + "%" : "—";
}

function photoSetFrame(id, scale) {
    if (!photoCrop[id]) photoCrop[id] = { scale: 1, x: 0, y: 0, rot: 0 };
    photoCrop[id].scale = scale;
    photoCrop[id].x = 0;
    photoCrop[id].y = 0;
    applyCrop(id);
    savePhotoCrop(id);
}

// Fit = the whole photo inside the box. Fill = cover it. 100% = actual pixels.
function photoFit(id) { const f = photoFrame(id); if (f) photoSetFrame(id, f.contain / f.cover); }
function photoFill(id) { if (photoFrame(id)) photoSetFrame(id, 1); }
function photoActualSize(id) { const f = photoFrame(id); if (f) photoSetFrame(id, 1 / f.cover); }

function straightenPhoto(id, deg) {
    if (!photoCrop[id]) photoCrop[id] = { scale: 1, x: 0, y: 0, rot: 0 };
    photoCrop[id].rot = Math.max(-15, Math.min(15, parseFloat(deg) || 0));
    applyCrop(id);
    savePhotoCrop(id);
}

// The photo box before this one that actually holds a picture.
function photoPartner(id) {
    const boxes = Array.prototype.slice.call(document.querySelectorAll("#report .photo-box"));
    const mine = boxes.find((b) => b.querySelector(".upload-area[id='" + id + "Area']"));
    const rest = boxes.filter((b) => b !== mine);
    for (const b of rest) {
        const a = b.querySelector(".upload-area[id$='Area']");
        if (!a) continue;
        const other = a.id.replace(/Area$/, "");
        const pv = document.getElementById(other + "Preview");
        if (pv && pv.src && pv.style.display !== "none") return other;
    }
    return null;
}

// Same zoom, position and straighten as the other photo, so a before/after pair
// lines up instead of being framed by hand twice.
function matchOtherPhoto(id) {
    const other = photoPartner(id);
    if (!other) return;
    const o = photoCrop[other] || {};
    photoCrop[id] = { scale: o.scale || 1, x: o.x || 0, y: o.y || 0, rot: o.rot || 0 };
    applyCrop(id);
    savePhotoCrop(id);
    const sl = document.getElementById(id + "Straighten");
    if (sl) sl.value = photoCrop[id].rot;
}

function savePhotoCrop(id) {
    bindFreshDraft();

    try { localStorage.setItem(id + "Crop", JSON.stringify(photoCrop[id])); }
    catch (e) { warnStorageFull("this photo's framing"); }

}

function resetCrop(id) {

    photoCrop[id] = { scale: 1, x: 0, y: 0, rot: 0 };
    applyCrop(id);
    savePhotoCrop(id);

    const sl = document.getElementById(id + "Straighten");
    if (sl) sl.value = 0;

}

// ---------- MAGNIFIED INSET ----------
// Draw a box over a detail (a crack, a burn mark) and an enlarged copy of it is
// drawn in a corner of the photo, with a line joining the two - the way an
// inspection report shows close-ups.
//
// Where a point in mark coordinates lands in the ORIGINAL photo's pixels. The
// picture is drawn "cover" inside the box and then panned/zoomed by photoCrop,
// so both steps have to be undone.
function markPointToSource(id, mx, my) {

    const f = photoFrame(id);
    const canvas = photoCanvas(id);
    const area = document.getElementById(id + "Area");
    if (!f || !canvas || !area) return null;

    const c = canvas.getBoundingClientRect(), a = area.getBoundingClientRect();
    if (!c.width || !a.width) return null;

    // mark space -> pixels inside the photo box
    const px = (mx / ANNOT_W) * c.width + (c.left - a.left);
    const py = (my / ANNOT_H) * c.height + (c.top - a.top);

    // undo the pan/zoom (about the centre of the box)
    const cr = photoCrop[id] || { scale: 1, x: 0, y: 0 };
    const s = cr.scale || 1;
    const ux = ((px - a.width / 2) - (cr.x || 0)) / s + a.width / 2;
    const uy = ((py - a.height / 2) - (cr.y || 0)) / s + a.height / 2;

    // undo "cover": the picture is f.cover times its natural size, centred
    const drawnW = f.nw * f.cover, drawnH = f.nh * f.cover;
    const offX = (a.width - drawnW) / 2, offY = (a.height - drawnH) / 2;

    return { x: (ux - offX) / f.cover, y: (uy - offY) / f.cover };

}

function drawInset(id, ctx, s) {

    const img = document.getElementById(id + "Preview");
    if (!img || !img.naturalWidth) return;

    const a = markPointToSource(id, Math.min(s.x1, s.x2), Math.min(s.y1, s.y2));
    const b = markPointToSource(id, Math.max(s.x1, s.x2), Math.max(s.y1, s.y2));
    if (!a || !b) return;

    const selW = b.x - a.x, selH = b.y - a.y;
    if (selW < 2 || selH < 2) return;

    // The enlarged copy sits INSIDE the photo, in the corner furthest from the
    // detail. It is fitted into a cap of a third of the width and half the
    // height - a tall selection used to make a panel taller than the photo that
    // hung off the edge and over the next box.
    const box = photoInsideBox(id);
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    const pad = Math.max(4, bw * 0.02);

    // IMPORTANT: the mark layer is 800x300 units stretched over a much taller
    // canvas, so one unit across is NOT one unit down (about 1 : 2.2). All of
    // this has to be worked out in what the eye sees, or a "4:3" box in units
    // comes out as a portrait sliver on the page.
    const canvasRect = photoCanvas(id).getBoundingClientRect();
    const ux = canvasRect.width / ANNOT_W;          // px per unit across
    const uy = canvasRect.height / ANNOT_H;         // px per unit down
    const q = (uy / ux) || 1;                       // how much taller a unit is

    // A panel of consistent shape and size ON SCREEN: 4:3, a third of the
    // photo's width, never more than half its height.
    let iw = bw * 0.34;
    let ih = (iw * 0.75) / q;                       // 4:3 once the stretch is undone
    if (ih > bh * 0.5) { ih = bh * 0.5; iw = (ih * q) / 0.75; }

    // Fill that panel from around the detail, without squashing it.
    const panelAspect = (iw * ux) / (ih * uy);
    let sw = selW, sh = selH;
    if (selW / selH < panelAspect) sw = selH * panelAspect; else sh = selW / panelAspect;
    let sx = (a.x + b.x) / 2 - sw / 2;
    let sy = (a.y + b.y) / 2 - sh / 2;
    sx = Math.max(0, Math.min(sx, img.naturalWidth - sw));
    sy = Math.max(0, Math.min(sy, img.naturalHeight - sh));

    // How much bigger the detail appears in the panel than on the photo (widths
    // in screen px, so the figure is honest).
    const mag = ((iw * ux) * (selW / sw)) / Math.max(1, Math.abs(s.x2 - s.x1) * ux);

    // furthest corner from the middle of the detail
    const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
    const onLeft = mx > (box.x0 + box.x1) / 2;     // detail on the right -> inset left
    const onTop = my > (box.y0 + box.y1) / 2;      // detail low -> inset high

    let dx = onLeft ? box.x0 + pad : box.x1 - iw - pad;
    let dy = onTop ? box.y0 + pad : box.y1 - ih - pad;

    // never outside the photo, whatever the numbers say
    dx = Math.max(box.x0 + pad, Math.min(dx, box.x1 - iw - pad));
    dy = Math.max(box.y0 + pad, Math.min(dy, box.y1 - ih - pad));

    ctx.save();

    // joining line, drawn first so the boxes sit on top of it: from the nearest
    // side of the detail to the nearest side of the inset, so it does not run
    // across the subject.
    ctx.strokeStyle = ANNOT_COLOR;
    ctx.lineWidth = ANNOT_LINE * 0.7;
    ctx.beginPath();
    ctx.moveTo(onLeft ? Math.min(s.x1, s.x2) : Math.max(s.x1, s.x2), my);
    ctx.lineTo(onLeft ? dx + iw : dx, dy + ih / 2);
    ctx.stroke();

    // the detail, enlarged
    ctx.beginPath();
    ctx.rect(dx, dy, iw, ih);
    ctx.clip();
    try { ctx.drawImage(img, sx, sy, sw, sh, dx, dy, iw, ih); } catch (e) { /* not ready */ }
    ctx.restore();

    // a box round each end
    ctx.save();
    ctx.strokeStyle = ANNOT_COLOR;
    ctx.lineWidth = ANNOT_LINE;
    ctx.strokeRect(dx, dy, iw, ih);
    ctx.strokeRect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1));

    // No magnification text on the panel: on a 103x78 px close-up printed at A4
    // it is a smudge rather than a figure, and the layer's stretched units make
    // it hard to keep legible. The scale belongs in the figure caption instead.
    ctx.restore();

}

// ---------- CROP TO AN AREA (drag a rectangle over the part you want) ----------
const photoRectMode = {};

function photoRectToggle(id, btn) {

    photoRectMode[id] = !photoRectMode[id];

    if (photoRectMode[id]) {
        disarmOtherPhotos(id);
        // One mode at a time: no panning, no drawing.
        photoCropMode[id] = false;
        photoActiveTool[id] = null;
        const cv = photoCanvas(id);
        if (cv) { cv.style.pointerEvents = "none"; cv.style.cursor = ""; cv.style.zIndex = ""; }
    }

    const area = document.getElementById(id + "Area");
    if (area) area.style.cursor = photoRectMode[id] ? "crosshair" : "";

    const box = btn.closest(".photo-box");
    if (box) box.querySelectorAll(".photo-toolbar button").forEach((b) => b.classList.remove("tool-active"));
    if (photoRectMode[id]) btn.classList.add("tool-active");

}

function initPhotoRect(id) {

    const area = document.getElementById(id + "Area");
    if (!area) return;

    let rect = null, sx = 0, sy = 0;

    area.addEventListener("pointerdown", (e) => {

        if (!photoRectMode[id]) return;
        e.preventDefault();

        const r = area.getBoundingClientRect();
        sx = e.clientX - r.left; sy = e.clientY - r.top;

        rect = document.createElement("div");
        rect.className = "crop-rect";
        rect.style.left = sx + "px"; rect.style.top = sy + "px";
        rect.style.width = "0px"; rect.style.height = "0px";
        area.appendChild(rect);

        try { area.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    });

    area.addEventListener("pointermove", (e) => {

        if (!rect) return;
        const r = area.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
        const y = Math.max(0, Math.min(e.clientY - r.top, r.height));

        rect.style.left = Math.min(sx, x) + "px";
        rect.style.top = Math.min(sy, y) + "px";
        rect.style.width = Math.abs(x - sx) + "px";
        rect.style.height = Math.abs(y - sy) + "px";

    });

    function done(e) {

        if (!rect) return;

        const r = area.getBoundingClientRect();
        const sel = {
            l: parseFloat(rect.style.left), t: parseFloat(rect.style.top),
            w: parseFloat(rect.style.width), h: parseFloat(rect.style.height)
        };
        rect.remove();
        rect = null;

        // A tap, not a drag: nothing to crop to.
        if (sel.w < 12 || sel.h < 12) return;

        const c = photoCrop[id] || { scale: 1, x: 0, y: 0, rot: 0 };
        const k = Math.min(r.width / sel.w, r.height / sel.h);

        // Bring the middle of the chosen area to the middle of the box, then zoom
        // so that area fills it.
        const qx = sel.l + sel.w / 2, qy = sel.t + sel.h / 2;
        const dx = qx - r.width / 2 - (c.x || 0);
        const dy = qy - r.height / 2 - (c.y || 0);

        photoCrop[id] = {
            scale: (c.scale || 1) * k,
            x: -k * dx,
            y: -k * dy,
            rot: c.rot || 0
        };

        applyCrop(id);
        savePhotoCrop(id);

        // One rectangle per press of Crop, so the next drag is not a surprise.
        photoRectMode[id] = false;
        area.style.cursor = "";
        const box = area.closest(".photo-box");
        if (box) box.querySelectorAll(".photo-toolbar button").forEach((b) => b.classList.remove("tool-active"));

    }

    area.addEventListener("pointerup", done);
    area.addEventListener("pointercancel", () => { if (rect) { rect.remove(); rect = null; } });

}

// Turns crop mode on/off. In crop mode the drawing tools are off, so dragging
// pans the photo instead of drawing on it.
function photoCropToggle(id, btn) {

    photoCropMode[id] = !photoCropMode[id];

    const area = document.getElementById(id + "Area");
    if (area) area.style.cursor = photoCropMode[id] ? "move" : "";

    if (photoCropMode[id]) {

        disarmOtherPhotos(id);

        // One mode at a time. Crop was NOT cleared here, so arming Crop and then
        // Pan left both live on the same box: one drag panned the photo AND
        // applied a zoom-to-rectangle on release.
        photoRectMode[id] = false;
        photoActiveTool[id] = null;
        const c = photoCanvas(id);
        if (c) {
            c.style.pointerEvents = "none";
            c.style.cursor = "";
            c.style.zIndex = "";
        }

    }

    // The whole toolbar of this photo (it has two rows): a drawing tool in the
    // other row stayed highlighted while dragging now panned.
    const tbar = btn.closest(".photo-box") || btn.parentElement;
    tbar.querySelectorAll(".photo-toolbar button, button").forEach((b) => b.classList.remove("tool-active"));

    if (photoCropMode[id]) btn.classList.add("tool-active");

}

function initPhotoCrop(id) {

    // Wired here so every photo box - including ones added later - gets both.
    initPhotoRect(id);

    const area = document.getElementById(id + "Area");

    let panning = false, sx = 0, sy = 0, ox = 0, oy = 0;

    area.addEventListener("pointerdown", (e) => {

        if (!photoCropMode[id]) return;

        panning = true;
        sx = e.clientX; sy = e.clientY;
        ox = photoCrop[id].x; oy = photoCrop[id].y;

        try { area.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    });

    area.addEventListener("pointermove", (e) => {

        if (!panning) return;

        photoCrop[id].x = ox + (e.clientX - sx);
        photoCrop[id].y = oy + (e.clientY - sy);

        applyCrop(id);

    });

    function end() { if (panning) { panning = false; savePhotoCrop(id); } }

    area.addEventListener("pointerup", end);
    area.addEventListener("pointerleave", end);

    area.addEventListener("dblclick", () => { if (photoCropMode[id]) resetCrop(id); });

    area.addEventListener("wheel", (e) => {

        if (!photoCropMode[id]) return;

        e.preventDefault();

        const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;

        // The floor is the Fit / 100% view, not 1 ("Fill"): after Fit the scale is
        // below 1, and clamping at 1 made scrolling to zoom OUT jump the photo IN.
        const fr0 = photoFrame(id);
        const minScale = fr0 ? Math.min(1, fr0.contain / fr0.cover, 1 / fr0.cover) : 1;
        photoCrop[id].scale = Math.min(6, Math.max(minScale, photoCrop[id].scale * f));

        applyCrop(id);
        savePhotoCrop(id);

    }, { passive: false });

}

function initPhotoDraw(id) {

    const canvas = photoCanvas(id);

    let drawing = false;
    let current = null;
    let dragText = null;   // a text label being repositioned
    let moveFrom = null;   // {x,y,shape,start} while dragging a selected mark
    let resizeK = null;    // which corner handle is being dragged

    function point(e) {

        const r = canvas.getBoundingClientRect();

        return {
            x: ((e.clientX - r.left) / r.width) * ANNOT_W,
            y: ((e.clientY - r.top) / r.height) * ANNOT_H
        };

    }

    canvas.addEventListener("pointerdown", (e) => {

        if (!photoActiveTool[id]) return;

        e.preventDefault();

        const p = point(e);

        // ---- Select: pick a mark, drag it, or drag a corner to resize it ----
        if (photoActiveTool[id] === "select") {

            const k = handleAt(id, p.x, p.y);

            if (k) {
                resizeK = k;
                drawing = true;
                try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
                return;
            }

            const i = shapeAt(id, p.x, p.y);
            selectShape(id, i);

            if (i >= 0) {
                const s = photoShapes[id][i];
                moveFrom = {
                    x: p.x, y: p.y,
                    start: s.type === "text" ? { x: s.x, y: s.y }
                                             : { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }
                };
                drawing = true;
                try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            }

            return;

        }

        if (photoActiveTool[id] === "text") {

            // Click an existing label to move it; click empty space to add one.
            const hit = textAt(id, p.x, p.y);

            if (hit) {

                dragText = hit;

                drawing = true;

                try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

                return;

            }

            const name = prompt("Label text:");

            if (name && name.trim()) {

                photoShapes[id].push({ type: "text", x: p.x, y: p.y, text: name.trim() });

                redrawPhoto(id);

                savePhotoAnnot(id);

            }

            return;

        }

        drawing = true;

        current = { type: photoActiveTool[id], x1: p.x, y1: p.y, x2: p.x, y2: p.y, _seq: ++annotSeq };

        photoShapes[id].push(current);

        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    });

    canvas.addEventListener("pointermove", (e) => {

        if (!drawing) return;

        const p = point(e);

        // ---- moving or resizing the selected mark ----
        const sel = photoShapes[id][photoSel[id]];

        if (resizeK && sel) {
            if (resizeK === "tl") { sel.x1 = p.x; sel.y1 = p.y; }
            else if (resizeK === "tr") { sel.x2 = p.x; sel.y1 = p.y; }
            else if (resizeK === "bl") { sel.x1 = p.x; sel.y2 = p.y; }
            else { sel.x2 = p.x; sel.y2 = p.y; }
            clampShape(id, sel);
            redrawPhoto(id);
            return;
        }

        if (moveFrom && sel) {
            const dx = p.x - moveFrom.x, dy = p.y - moveFrom.y;
            if (sel.type === "text") {
                sel.x = moveFrom.start.x + dx;
                sel.y = moveFrom.start.y + dy;
            } else {
                sel.x1 = moveFrom.start.x1 + dx; sel.x2 = moveFrom.start.x2 + dx;
                sel.y1 = moveFrom.start.y1 + dy; sel.y2 = moveFrom.start.y2 + dy;
            }
            clampShape(id, sel);
            redrawPhoto(id);
            return;
        }

        if (dragText) {

            dragText.x = p.x;
            dragText.y = p.y;

        } else {

            current.x2 = p.x;
            current.y2 = p.y;

        }

        redrawPhoto(id);

    });

    function finish() {

        if (!drawing) return;

        drawing = false;

        // a mark was moved or resized
        if (moveFrom || resizeK) {
            moveFrom = null;
            resizeK = null;
            savePhotoAnnot(id);
            return;
        }

        // a newly drawn mark stays on the photo when "Keep inside" is on
        if (current) clampShape(id, current);

        if (dragText) {

            dragText = null;

        } else if (current && Math.hypot(current.x2 - current.x1, current.y2 - current.y1) < 8) {

            // Drop specks from an accidental click.
            photoShapes[id].pop();

            redrawPhoto(id);

        }

        current = null;

        savePhotoAnnot(id);

    }

    canvas.addEventListener("pointerup", finish);
    // NOTE: don't finish on "pointerleave" - the pointer is captured, so we WANT
    // to keep drawing as it moves outside the canvas (that's how an arrow/circle
    // reaches outside the box). pointercancel still ends a cancelled gesture.
    canvas.addEventListener("pointercancel", finish);

}

// ===========================================
// EXTRA PHOTOS (added by the user, shown on page 2)
// ===========================================

let extraPhotoSeq = 0;

function registerPhoto(id) {
    if (!(id in photoShapes)) photoShapes[id] = [];
    if (!(id in photoLabels)) photoLabels[id] = [];
    if (!(id in photoCrop)) photoCrop[id] = { scale: 1, x: 0, y: 0 };
    if (!(id in photoActiveTool)) photoActiveTool[id] = null;
}

function extraPhotoBox(id, num) {
    const q = "'";
    return '<div class="photo-box" data-extra="' + id + '">' +
        '<div class="photo-stage">' +
            '<div class="photo-caption caption-top" id="' + id + 'CaptionTop" contenteditable="true" data-placeholder="Add a topic for this photograph"></div>' +
            '<div class="upload-area" id="' + id + 'Area">' +
                '<img id="' + id + 'Preview" alt="">' +
                '<span id="' + id + 'Placeholder" onclick="photoUploadClick(' + q + id + q + ')">Click to upload or drop an image</span>' +
                '<input type="file" id="' + id + 'Photo" accept="image/*" hidden>' +
            '</div>' +
            '<div class="photo-caption caption-bottom">' +
                '<span class="fig-no">Fig ' + (num + 2) + '</span> ' +
                '<span class="fig-text" id="' + id + 'CaptionBottom" contenteditable="true" data-placeholder="describe this photograph"></span>' +
            '</div>' +
            '<canvas id="' + id + 'Annot" class="photo-annot" width="800" height="300"></canvas>' +
            '<div class="label-layer" id="' + id + 'Labels"></div>' +
        '</div>' +
        '<div class="photo-toolbar">' +
            '<span class="pt-row"><span class="tb-label">Picture</span>' +
            '<button type="button" onclick="photoUploadClick(' + q + id + q + ')">Photo</button>' +
            '<button type="button" onclick="photoCropToggle(' + q + id + q + ',this)" title="Drag to move the photo, scroll to zoom">Pan</button>' +
            '<button type="button" onclick="photoRectToggle(' + q + id + q + ',this)" title="Drag a rectangle over the part you want">Crop</button>' +
            '<button type="button" onclick="rotatePhoto(' + q + id + q + ')" title="Turn the photo 90°">Rotate</button>' +
            '<button type="button" onclick="photoFit(' + q + id + q + ')" title="Show the whole photo">Fit</button>' +
            '<button type="button" onclick="photoFill(' + q + id + q + ')" title="Fill the box">Fill</button>' +
            '<button type="button" onclick="photoActualSize(' + q + id + q + ')" title="Actual size">100%</button>' +
            '<button type="button" onclick="matchOtherPhoto(' + q + id + q + ')" title="Use the same framing as the other photo">Match</button>' +
            '<span class="zoom-pct" title="Zoom (100% = actual size)">Zoom <b id="' + id + 'Zoom">—</b></span>' +
            '<label class="straighten">Straighten<input type="range" id="' + id + 'Straighten" min="-15" max="15" step="0.5" value="0" oninput="straightenPhoto(' + q + id + q + ',this.value)"></label>' +
            '<label class="keep-inside" title="Print this photo in black and white"><input type="checkbox" id="' + id + 'Gray" onchange="setPhotoGray(' + q + id + q + ',this.checked)"> Grey</label>' +
            '</span><span class="pt-row"><span class="tb-label">Marks</span>' +
            '<button type="button" onclick="photoTool(' + q + id + q + ',' + q + 'select' + q + ',this)" title="Click a mark to select it, then drag it, drag a corner to resize, or press Delete">Select</button>' +
            '<button type="button" onclick="photoTool(' + q + id + q + ',' + q + 'circle' + q + ',this)">Circle</button>' +
            '<button type="button" onclick="photoTool(' + q + id + q + ',' + q + 'arrow' + q + ',this)">Arrow</button>' +
            '<button type="button" onclick="photoTool(' + q + id + q + ',' + q + 'inset' + q + ',this)" title="Drag a box over a detail - an enlarged copy is shown in the corner">Zoom box</button>' +
            '<button type="button" onclick="addPhotoLabel(' + q + id + q + ')">A Label</button>' +
            '<button type="button" onclick="photoUndo(' + q + id + q + ')">Undo</button>' +
            '<button type="button" onclick="photoClear(' + q + id + q + ')">Clear</button>' +
            '<button type="button" class="tbl-remove" onclick="removeExtraPhoto(' + q + id + q + ')">× Remove</button>' +
            '<label class="keep-inside" title="Stop marks being dragged off the photo"><input type="checkbox" id="' + id + 'Inside" checked onchange="setMarksInside(' + q + id + q + ',this.checked)"> Keep inside</label>' +
            '</span>' +
        '</div>' +
    '</div>';
}

// Figures are numbered by their order on the page, not by when they were made,
// so removing a photo renumbers the rest instead of leaving a gap.
function renumberFigures() {
    const boxes = document.querySelectorAll("#report .photo-box");
    let n = 0;
    boxes.forEach((box) => {
        if (box.offsetParent === null && box.closest("#extraPhotoCard") &&
            document.getElementById("extraPhotoCard").style.display === "none") return;
        const no = box.querySelector(".fig-no");
        if (!no) return;
        n += 1;
        no.textContent = "Fig " + n;
    });
}

function addPhoto() {
    extraPhotoSeq += 1;
    const id = "extra" + extraPhotoSeq;
    const num = document.querySelectorAll("#extraPhotos .photo-box").length + 1;
    registerPhoto(id);
    const holder = document.createElement("div");
    holder.innerHTML = extraPhotoBox(id, num);
    const box = holder.firstElementChild;
    const wasHidden = document.getElementById("extraPhotoCard").style.display === "none";
    document.getElementById("extraPhotos").appendChild(box);
    document.getElementById("extraPhotoCard").style.display = "";

    // The report now grows onto extra pages, so a full page is no reason to
    // refuse a photo (this used to say "The report stays two pages"). The one
    // real limit: the extra-photographs section moves as a whole, so it cannot
    // be taller than a whole A4 page. Measure that in the print layout (toolbars
    // hidden), as in the PDF.
    const card = document.getElementById("extraPhotoCard");
    // Measured on the real result, after the pages have been re-flowed: the page
    // holding the photo section overflows although that section is the only
    // thing left on it. (Adding up heights by hand missed the gaps between the
    // header and the section, so one photo too many got in and the page shrank.)
    const tallerThanPage = () => {
        const page = card.closest(".page");
        const fit = page ? page.querySelector(":scope > .page-inner > .page-fit") : null;
        if (!fit || !fit.parentElement.clientHeight) return false;
        return fit.scrollHeight > fit.parentElement.clientHeight + 1 && visibleFlowCount(fit) <= 1;
    };
    // hideScreenOnly() clears every photo's selection so no dashed handle box is
    // ever captured into the PDF. Here it is only being used to MEASURE, so put
    // the selection back afterwards - adding a photo used to silently deselect
    // the mark the user was working on.
    const selBefore = Object.assign({}, photoSel);
    hideScreenOnly(true);
    checkPageFit();
    const tooTallInPdf = tallerThanPage();
    hideScreenOnly(false);
    checkPageFit();
    Object.keys(selBefore).forEach((pid) => {
        if (selBefore[pid] == null || selBefore[pid] < 0) return;
        if (!photoShapes[pid] || !photoShapes[pid][selBefore[pid]]) return;   // it went away
        photoSel[pid] = selBefore[pid];
        redrawPhoto(pid);
    });
    // On screen the photo toolbars make the section taller still - refuse there
    // too, so the page on screen is never shrunk to fit either.
    const tooTall = tooTallInPdf || tallerThanPage();
    if (tooTall) {
        box.remove();
        extraPhotoSeq -= 1;
        delete photoShapes[id];
        delete photoCrop[id];
        delete photoActiveTool[id];
        delete photoLabels[id];
        if (wasHidden) card.style.display = "none";
        saveExtraPhotos();
        checkPageFit();
        alert("The extra photographs already fill a whole A4 page, so this section cannot take another photo.\n\n" +
            "To add more, use Add Page and paste the photo into that page, or remove a photo here first.");
        return;
    }

    setupPhotoUpload(id);
    initPhotoDraw(id);
    initPhotoCrop(id);
    saveExtraPhotos();
}

function removeExtraPhoto(id) {
    const box = document.querySelector('.photo-box[data-extra="' + id + '"]');
    if (box) box.remove();
    // Gray and Inside were left behind, so a LATER photo given the same id came
    // back grey (or refused to clamp its marks) for no visible reason.
    ["Photo", "Annot", "Crop", "Labels", "Gray", "Inside"].forEach((k) => localStorage.removeItem(id + k));
    delete photoShapes[id];
    delete photoCrop[id];
    delete photoActiveTool[id];
    delete photoLabels[id];          // a later photo re-using this id must not inherit its labels
    delete photoSel[id];             // a stale selection here crashed the PDF export
    delete photoGray[id];
    delete photoInside[id];
    delete photoCropMode[id];
    delete photoRectMode[id];
    if (lastPhotoId === id) lastPhotoId = null;   // or Ctrl+V pasted into a box that no longer exists
    if (!document.querySelector("#extraPhotos .photo-box")) {
        document.getElementById("extraPhotoCard").style.display = "none";
    }
    renumberFigures();
    saveExtraPhotos();
    checkPageFit();
}

function saveExtraPhotos() {
    bindFreshDraft();
    const clone = document.getElementById("extraPhotos").cloneNode(true);
    clone.querySelectorAll("img").forEach((im) => im.removeAttribute("src"));
    // Labels are restored from their own storage key, so don't bake them into
    // the HTML (avoids duplicates on restore).
    clone.querySelectorAll(".label-layer").forEach((l) => (l.innerHTML = ""));
    // A throw here used to abort the rest of addPhoto(), leaving a half-built
    // photo box on screen.
    try { localStorage.setItem("extraPhotosHTML", clone.innerHTML); }
    catch (e) { warnStorageFull("the added photo boxes"); }
}

function restoreExtraPhotos() {
    const html = localStorage.getItem("extraPhotosHTML");
    if (!html) return;

    // Parse the saved markup only to recover the list of photos and the caption
    // text the user typed. Then REBUILD each box from the CURRENT template, so
    // photos saved by an older version get the latest structure (the stage +
    // enlarged drawing canvas that can go outside the box).
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const saved = temp.querySelectorAll('.photo-box[data-extra]');
    if (!saved.length) return;

    const cont = document.getElementById("extraPhotos");
    cont.innerHTML = "";

    saved.forEach((old, idx) => {
        const id = old.getAttribute("data-extra");
        const n = parseInt(id.replace("extra", ""), 10);
        if (!isNaN(n) && n > extraPhotoSeq) extraPhotoSeq = n;

        registerPhoto(id);
        // A rebuilt box starts with no tool, Pan or Crop armed (its buttons are
        // new and un-highlighted; the old modes kept dragging live).
        photoActiveTool[id] = null; photoCropMode[id] = false; photoRectMode[id] = false; photoSel[id] = -1;
        cont.insertAdjacentHTML("beforeend", extraPhotoBox(id, idx + 1));

        // Carry over the caption text. (The figure NUMBER is not carried over -
        // renumberFigures() below sets it from the order on the page, so a
        // report saved with a photo missing does not come back with a gap.)
        const ct = old.querySelector('[id$="CaptionTop"]');
        const cb = old.querySelector('[id$="CaptionBottom"]');
        const ctEl = document.getElementById(id + "CaptionTop");
        const cbEl = document.getElementById(id + "CaptionBottom");
        if (ct && ctEl) ctEl.innerHTML = ct.innerHTML;
        if (cb && cbEl) cbEl.innerHTML = cb.innerHTML;

        setupPhotoUpload(id);
        initPhotoDraw(id);
        initPhotoCrop(id);

        const img = localStorage.getItem(id + "Photo");
        if (img) {
            const pv = document.getElementById(id + "Preview");
            pv.src = img; pv.style.display = "block";
            document.getElementById(id + "Placeholder").style.display = "none";
        }
        const annot = localStorage.getItem(id + "Annot");
        if (annot !== null) { try { photoShapes[id] = JSON.parse(annot) || []; } catch (e) { /* keep */ } redrawPhoto(id); }
        const crop = localStorage.getItem(id + "Crop");
        if (crop !== null) { try { photoCrop[id] = JSON.parse(crop); } catch (e) { /* keep */ } applyCrop(id); }
        // Everything else Before/After get back in loadSavedImages() - these were
        // missing for added photos, so a greyed photo came back in colour with
        // its Grey box unticked (while the PDF still printed it grey), Keep
        // inside always showed ticked, and the Straighten slider read 0.
        const slx = document.getElementById(id + "Straighten");
        if (slx && photoCrop[id]) slx.value = photoCrop[id].rot || 0;
        applyPhotoGray(id);
        const inx = document.getElementById(id + "Inside");
        if (inx) inx.checked = marksInside(id);
        const labels = localStorage.getItem(id + "Labels");
        if (labels !== null) { try { photoLabels[id] = JSON.parse(labels) || []; } catch (e) { photoLabels[id] = []; } }
        renderPhotoLabels(id);
    });

    document.getElementById("extraPhotoCard").style.display = "";

    // Number the figures from the order on the page, so a report saved with a
    // photo deleted comes back 1, 2, 3 rather than with the gap it was saved with.
    renumberFigures();

    // Persist the upgraded markup so it stays fresh next time.
    saveExtraPhotos();
}

// ===========================================
// DATE FIELDS  (DD/MM/YYYY)
// ===========================================

const DATE_FIELDS = ["reportDate", "startDate", "endDate"];

function pad2(n) {

    return String(n).padStart(2, "0");

}

function formatDMY(dt) {

    return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;

}

// Accepts 12052026, 12/05/2026, 12-05-26, 12.5.2026 ... always reads as DAY first.
function parseDMY(text) {

    const digits = (text || "").replace(/\D/g, "");

    let d, m, y;

    // Separated parts first, so a single-digit day or month works: "1/5/2026"
    // is 7 digits run together and was rejected, and "1/5/26" became day 15,
    // month 20. With separators the parts are unambiguous.
    const parts = String(text || "").match(/\d+/g) || [];

    if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 &&
        (parts[2].length === 4 || parts[2].length === 2)) {

        d = +parts[0];
        m = +parts[1];
        y = parts[2].length === 4 ? +parts[2] : 2000 + +parts[2];

    } else if (digits.length === 8) {

        d = +digits.slice(0, 2);
        m = +digits.slice(2, 4);
        y = +digits.slice(4, 8);

    } else if (digits.length === 6) {

        d = +digits.slice(0, 2);
        m = +digits.slice(2, 4);
        y = 2000 + +digits.slice(4, 6);

    } else {

        return null;

    }

    const dt = new Date(y, m - 1, d);

    // Rejects 31/02/2026 and similar non-existent dates.
    if (dt.getDate() !== d || dt.getMonth() !== m - 1 || dt.getFullYear() !== y) {

        return null;

    }

    return dt;

}

function normalizeDateField(el) {

    const raw = el.innerText.trim();

    if (!raw) {

        el.classList.remove("invalid");
        el.textContent = "";
        el.removeAttribute("title");

        // Clearing Start Date must also clear an "earlier than Start Date"
        // error left on End Date.
        validateDateOrder();

        return;

    }

    const dt = parseDMY(raw);

    if (!dt) {

        el.classList.add("invalid");
        el.setAttribute("title", "Enter a valid date as DD/MM/YYYY");

        // An "earlier than Start Date" error on End Date was judged against the
        // start date that is no longer there.
        validateDateOrder();

        return;

    }

    el.textContent = formatDMY(dt);
    el.classList.remove("invalid");
    el.removeAttribute("title");

    validateDateOrder();

    mirrorHeader();

}

function validateDateOrder() {

    const startEl = document.getElementById("startDate");
    const endEl = document.getElementById("endDate");

    const start = parseDMY(startEl.innerText);
    const end = parseDMY(endEl.innerText);

    if (start && end && end < start) {

        endEl.classList.add("invalid");
        endEl.setAttribute("title", "End Date cannot be earlier than Start Date");

    } else if (end) {

        endEl.classList.remove("invalid");
        endEl.removeAttribute("title");

    }

}

// Adds a calendar button and a native <input type="date"> beside a field, so
// the date can be picked as well as typed. The field itself stays the single
// source of truth, always holding DD/MM/YYYY text.
function attachDatePicker(el) {

    const wrap = document.createElement("span");

    wrap.className = "date-wrap";

    el.parentNode.insertBefore(wrap, el);

    wrap.appendChild(el);

    const picker = document.createElement("input");

    picker.type = "date";

    picker.className = "date-picker";

    picker.tabIndex = -1;

    const button = document.createElement("button");

    button.type = "button";

    button.className = "date-picker-btn";

    button.title = "Pick a date";

    button.textContent = "📅";

    wrap.appendChild(picker);

    wrap.appendChild(button);

    button.addEventListener("click", () => {

        // Seed the picker with whatever the field already holds.
        const current = parseDMY(el.innerText);

        // An empty field empties the picker too - otherwise picking the same date
        // again fires no "change" and the field stayed blank.
        picker.value = current
            ? `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`
            : "";

        // showPicker() is the supported way; clicking is the old fallback.
        if (typeof picker.showPicker === "function") {

            picker.showPicker();

        } else {

            picker.click();

        }

    });

    picker.addEventListener("change", () => {

        if (!picker.value) return;

        // picker.value is always YYYY-MM-DD, regardless of browser locale.
        const [y, m, d] = picker.value.split("-").map(Number);

        el.textContent = formatDMY(new Date(y, m - 1, d));

        el.classList.remove("invalid");

        el.removeAttribute("title");

        validateDateOrder();

        mirrorHeader();

        checkPageFit();

    });

}

function setupDateFields() {

    DATE_FIELDS.forEach((id) => {

        const el = document.getElementById(id);

        if (!el) return;

        attachDatePicker(el);

        el.addEventListener("keydown", (e) => {

            if (e.key === "Enter") {

                e.preventDefault();
                el.blur();

                return;

            }

            if (e.ctrlKey || e.metaKey || e.altKey) return;

            // Let navigation / editing keys through, block everything but digits
            // and a date separator ("/", "-" or "." - all read as DD/MM/YYYY).
            if (e.key.length > 1) return;

            if (!/[0-9/.\-]/.test(e.key)) {

                e.preventDefault();

            }

        });

        el.addEventListener("paste", (e) => {

            e.preventDefault();

            const text = (e.clipboardData || window.clipboardData).getData("text");

            // "12-05-2026" and "12.05.2026" keep their separators (as "/"):
            // stripping them ran the parts together, so "1-5-2026" became
            // "152026" and was rejected.
            document.execCommand("insertText", false,
                text.trim().replace(/[.\-\s]+/g, "/").replace(/[^0-9/]/g, ""));

        });

        el.addEventListener("blur", () => normalizeDateField(el));

    });

}

// ===========================================
// SAVE DRAFT
// ===========================================

document.getElementById("saveDraft").addEventListener("click", saveDraft);

// Saves everything to localStorage without any alert (used by auto-save).
function saveAll() {
    bindFreshDraft();

    // Only the report's own fields. The whole page used to be swept, which also
    // stored the RCA report and the test-case procedure as if they were report
    // fields (and New Report / Load Draft then emptied or overwrote them).
    report.querySelectorAll("[contenteditable='true']").forEach((item) => {
        if (item.id) localStorage.setItem(item.id, item.innerHTML);
    });

    localStorage.setItem("resultTables", resultTables.innerHTML);

    const appr = document.querySelector(".approval-table");
    if (appr) localStorage.setItem("approvalTable", appr.innerHTML);

    // The added pages, exactly as they are on screen (see saveManualPageList).
    saveManualPageList();

    // Whether Approval / Observation were removed belongs to this report too.
    const hiddenCard = (id) => { const c = document.getElementById(id); return !!c && c.style.display === "none"; };
    if (hiddenCard("approvalCard")) localStorage.setItem("approvalRemoved", "1"); else localStorage.removeItem("approvalRemoved");

    // How many columns each section is laid out in belongs to this report too.
    saveColumnChoices();

    if (hiddenCard("observationCard")) localStorage.setItem("observationRemoved", "1"); else localStorage.removeItem("observationRemoved");

}

// One quiet warning per session when the browser storage is full. The work is
// still on screen, but it will not survive a reload - saying nothing let the
// user carry on believing it was saved.
let storageWarned = false;

function warnStorageFull(what) {

    if (storageWarned) return;

    storageWarned = true;

    // Never while the page is being left / hidden: an alert there is blocked
    // anyway and would only be seen much later, out of context.
    if (document.hidden) return;

    alert("The browser storage is full, so " + what + " could not be saved.\n\n" +
        "Delete old reports in My Reports, or remove some photos, then try again.");

}

// The report as it looks with nothing entered - recorded at start-up.
let blankReportSig = null;

// Set just before the app reloads itself to open a saved report, so the report
// on screen is not written over the one being opened.
let skipUnloadSave = false;

function reportSignature() {

    // Content only: class attributes are left out, because the layout code adds
    // classes on its own (e.g. edge-right on table cells once the page is
    // shown), which made an untouched blank report look "changed".
    const bare = (html) => html.replace(/\sclass="[^"]*"/g, "");

    let s = "";

    report.querySelectorAll("[contenteditable='true']").forEach((item) => {
        if (item.id) s += item.id + "" + bare(item.innerHTML) + "";
    });

    const appr = document.querySelector(".approval-table");

    // Deliberately NOT including whether Approval / Observation were removed.
    // Tried it: a section removed on the blank start-up screen then counted as
    // "changed" and saved a blank report over the draft, and putting the
    // section back matched blank again so the flag was left behind - the draft
    // came back with a section missing that the user had restored. On a blank
    // report neither removing nor restoring a section is stored; once anything
    // is typed, saveAll writes the flags with the rest of the report.
    return s + bare(resultTables.innerHTML) + (appr ? bare(appr.innerHTML) : "");

}

// Save the report - but never a report that is still blank. The app opens
// blank on purpose, and saving then (on reload, or just switching browser tab)
// wrote empty fields over the saved draft, so Load Draft came back empty.
function saveIfChanged() {

    if (skipUnloadSave) return;

    // NEVER while the report is being turned into a PDF. The capture puts
    // export-only state on the page (the table tools carry inline display:none
    // + data-pdf-display, placeholders are switched off), and saving then wrote
    // that markup into the draft as `resultTables` - loadDraft restores it
    // verbatim, so the report came back with its "+ Row / + Column / Remove
    // table" controls invisible for good. The export takes seconds, so simply
    // switching tab or minimising during it was enough to trigger it.
    if (pdfBuilding || reportIsExporting()) return;

    if (blankReportSig !== null && reportSignature() === blankReportSig) return;

    try { saveAll(); } catch (e) { warnStorageFull("the draft"); }

}

// Auto-save as you type, and before leaving the page, so data is never lost.
let autoSaveTimer;
report.addEventListener("input", () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveIfChanged, 400);
});
window.addEventListener("beforeunload", saveIfChanged);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveIfChanged(); });

function saveDraft() {

    // Same reason as in saveIfChanged: mid-export the page is in its capture
    // state, and saving it would store hidden toolbars as the draft.
    if (pdfBuilding || reportIsExporting()) {
        alert("The PDF is still being built - try again in a moment.");
        return;
    }

    // Everything the auto-save stores - including the approval table, which
    // this button used to leave out.
    try {
        saveAll();
    } catch (e) {
        alert("Could not save the draft: " + (e && e.message ? e.message : e) +
            "\n\nThe browser storage may be full - remove large photos or old saved reports.");
        return;
    }

    alert("Draft Saved Successfully.");

}

// ===========================================
// LOAD DRAFT
// ===========================================

document.getElementById("loadDraft").addEventListener("click", () => loadDraft(true));

// announce is false on page load, so the user is not alerted on every visit.
function loadDraft(announce) {

    if (pvtPdfBusy()) return;

    clearObsUndo();

    // The screen now shows the stored draft, so later changes belong to it.
    draftBound = true;

    // Rebuild any pages added with "➕ Add Page" first, so their boxes exist to be filled.
    restoreManualPages();

    // Extra photo boxes too, BEFORE the fields: their captions are fields, and
    // rebuilding the boxes afterwards (as before) put back an old copy of the
    // captions over the ones just loaded.
    restoreExtraPhotos();

    const editable = report.querySelectorAll("[contenteditable='true']");

    editable.forEach((item) => {

        if (item.id) {

            const value = localStorage.getItem(item.id);

            if (value !== null) {

                item.innerHTML = value;

            }

        }

    });

    restoreColumnChoices();

    const savedTables = localStorage.getItem("resultTables");

    const savedAppr = localStorage.getItem("approvalTable");

    if (savedAppr !== null) { const appr = document.querySelector(".approval-table"); if (appr) appr.innerHTML = savedAppr; }


    if (savedTables !== null) resultTables.innerHTML = savedTables;

    loadSavedImages();
    redrawAllPhotos();       // again once each picture has decoded (insets, straighten)

    // Continue the marks' numbering after the restored ones, so Undo removes
    // the newest mark and not an old restored one.
    [photoShapes, photoLabels].forEach((store) => Object.keys(store).forEach((k) => {
        (store[k] || []).forEach((m) => { if (m && m._seq > annotSeq) annotSeq = m._seq; });
    }));

    DATE_FIELDS.forEach((id) => {

        const el = document.getElementById(id);

        if (el && el.innerText.trim()) normalizeDateField(el);

    });

    // A loaded conclusion counts as written: ✨ Pass / ✨ Fail must ask before
    // replacing it (it used to overwrite a loaded conclusion without asking).
    conclusionEdited = !!document.getElementById("conclusion").innerText.trim();

    // The draft's removed sections (Approval / Observation).
    applyApprovalState();
    applyObservationState();

    mirrorHeader();

    checkPageFit();

    if (announce) alert("Draft Loaded Successfully.");

}
// ===========================================
// EXPORT PDF (A4)
// ===========================================

document
.getElementById("downloadPDF")
.addEventListener("click", exportPDF);

document
.getElementById("previewPDF")
.addEventListener("click", previewPDF);

function buildFilename(){

    const no = document.getElementById("reportNo").innerText.trim();

    return no
        ? `Product Validation Test Report - ${no}.pdf`.replace(/[\\/:*?"<>|]/g, "-")
        : "Product Validation Test Report.pdf";

}

const CANVAS_OPTIONS = {

    // scale 3, not 2. At scale 2 a 1px hairline lands on a fractional device
    // pixel and rasterises as an uneven 2-3px grey smear, so rules that are all
    // identical in the DOM printed at visibly different weights and shades.
    // Scale 3 is what the RCA export uses, and it made the same problem go away.
    scale: 3,

    useCORS: true,

    backgroundColor: "#ffffff",

    // Capture from the top of the document. Without these, html2canvas can
    // offset the whole page downward when the window is scrolled, which pushed
    // the report into the lower half of the PDF.
    scrollX: 0,

    scrollY: 0,

    // Skip <img> elements that have no src and are not displayed - the empty
    // before/after photo slots when no photo is loaded. html2canvas still tried
    // to load them: a missing src resolves to index.html itself, fails as an
    // image, and left an "Uncaught (in promise) Event" in the console on every
    // PDF export. Hidden and src-less, they paint nothing and take no space, so
    // skipping them cannot change the PDF.
    ignoreElements: (el) => {
        if (el.tagName !== "IMG" || el.getAttribute("src")) return false;
        const view = el.ownerDocument && el.ownerDocument.defaultView;
        return !!view && view.getComputedStyle(el).display === "none";
    }

};

// On-screen controls that must never appear in the exported PDF.
const SCREEN_ONLY = ".auto-btn, .uploadLogoBtn, .page-warning, .date-picker-btn, .table-tools, .table-add-row, .approval-remove, .photo-toolbar, .logoAdjustBtn, .crop-rect";

// html2canvas clones each .page into a detached container, so a rule like
// "#report.exporting .auto-btn" stops matching - the #report ancestor is gone
// from the clone. Inline styles travel with the element, so they always win.
function hideScreenOnly(hidden){

    // No typing into the report while it is being captured: an edit then would
    // add or remove a page in the middle of the render.
    report.inert = !!hidden;

    // A selected mark must not print its dashed box and handles.
    if (hidden) {
        Object.keys(photoSel).forEach((pid) => {
            if (photoSel[pid] != null && photoSel[pid] >= 0) { photoSel[pid] = -1; redrawPhoto(pid); }
        });
    }

    // Remember each control's own inline display and put exactly that back. The
    // "+ Add Observation / Approval section" rows are hidden by an inline
    // display:none, and resetting everything to "" made them appear after every
    // export and every "+ Add Photo".
    report.querySelectorAll(SCREEN_ONLY).forEach((el) => {

        if (hidden) {
            if (el.dataset.pdfDisplay === undefined) el.dataset.pdfDisplay = el.style.display;
            el.style.display = "none";
        } else if (el.dataset.pdfDisplay !== undefined) {
            el.style.display = el.dataset.pdfDisplay;
            delete el.dataset.pdfDisplay;
        }

    });

    // Grey ":empty:before" hints such as "DD/MM/YYYY" are also screen-only.
    // A class on the element itself survives the clone; an ancestor rule does not.
    report.querySelectorAll("[data-placeholder]").forEach((el) => {

        el.classList.toggle("no-placeholder", hidden);

    });

    // "Click to Upload" must not print. A class rather than an inline style,
    // because the photo logic already owns the span's inline display.
    report.querySelectorAll(".upload-area").forEach((el) => {

        el.classList.toggle("hide-hint", hidden);

    });

    // Force the full A4 desktop layout onto every page. Without this, exporting
    // from a narrow or minimised window bakes the single-column responsive
    // layout into the PDF.
    report.querySelectorAll(".page").forEach((el) => {

        el.classList.toggle("print-layout", hidden);

    });

    // A photo box's 1px border printed three times too thick in the PDF
    // (measured 9 canvas px at scale 3) when it came from the stylesheet, yet
    // exactly 1px when the very same border was set inline on the element. So
    // pin it inline for the capture, keeping whatever inline value was there.
    report.querySelectorAll(".upload-area").forEach((el) => {

        if (hidden) {
            if (el.dataset.pdfBorder === undefined) el.dataset.pdfBorder = el.style.getPropertyValue("border");
            el.style.setProperty("border", "1px solid #111111", "important");
        } else if (el.dataset.pdfBorder !== undefined) {
            el.style.removeProperty("border");
            if (el.dataset.pdfBorder) el.style.setProperty("border", el.dataset.pdfBorder);
            delete el.dataset.pdfBorder;
        }

    });

    // Empty text boxes in the result area (the result sentence, a table heading,
    // an added note) keep their height on screen so there is somewhere to type.
    // In the PDF they only left a blank gap above the table - hide them there.
    report.querySelectorAll("#resultText, .table-heading, .result-note").forEach((el) => {

        const empty = !el.textContent.trim() && !el.querySelector("img");

        el.classList.toggle("pdf-empty-hidden", hidden && empty);

    });

    // Text boxes that contain text drop their minimum height for the PDF, so
    // the space under the last line matches every other section (see
    // .pdf-has-text in style.css). Empty ones keep it as writing space.
    report.querySelectorAll(".editor").forEach((el) => {

        const hasText = !!el.textContent.trim() || !!el.querySelector("img, table");

        el.classList.toggle("pdf-has-text", hidden && hasText);

    });

    // The approval cells' grey "Name / Sign / Date" hint is screen-only, like
    // every other placeholder hint (it is drawn by CSS on empty cells, so it
    // needs the same class-on-the-element treatment as [data-placeholder]).
    report.querySelectorAll(".approval-table td").forEach((td) => {

        td.classList.toggle("no-placeholder", hidden);

    });

    // Re-spread the pages for this state (in the capture state the screen-only
    // buttons are gone, so the PDF gets exactly the pages its content needs),
    // set the bar rules, and shrink a page only where one section is longer than
    // a whole page. That last step used to be skipped here, so such a section
    // was printed full size and cut off at the bottom of the PDF page.
    checkPageFit();

}

// Drop a block's bottom rule where the next VISIBLE block opens with a blue
// section bar - otherwise the rule prints directly on top of the bar as a
// double line. Hidden siblings (a removed section's restore button, the unused
// extra-photo card) are skipped, so the neighbour that is actually seen counts.
// See .bar-below in style.css.
function markBarRules(){

    // Looked up here rather than using the shared "report" constant, so this is
    // safe to call from anywhere, however early.
    const root = document.getElementById("report");

    if (!root) return;

    root.querySelectorAll(".section-card, .header-card").forEach((el) => {

        let next = el.nextElementSibling;

        while (next && window.getComputedStyle(next).display === "none") next = next.nextElementSibling;

        // The signature card has no heading of its own, but its table draws a top
        // line - so whatever sits above it must still drop its bottom rule, or the
        // two print as one thick double line (e.g. when the table starts a page).
        const opensWithBar = !!(next &&
            next.classList.contains("section-card") &&
            (next.querySelector(":scope > .section-title") || next.id === "approvalCard"));

        el.classList.toggle("bar-below", opensWithBar);

    });

    // A table sitting directly under a section heading: the heading already
    // draws a rule, so the table's own top line printed as a second line 1px
    // below it (the classic double line). Marked with a class here because a
    // class survives html2canvas's clone - a sibling/:has() rule would not.
    root.querySelectorAll(".data-table, .approval-table").forEach((table) => {

        const box = table.closest(".result-table-wrap, .section-card") || table.parentElement;
        let prev = table.previousElementSibling;
        while (prev && window.getComputedStyle(prev).display === "none") prev = prev.previousElementSibling;

        // Nothing visible before it inside its own box: look at what the whole
        // box follows (the heading of the section it belongs to).
        let above = prev;
        if (!above && box) {
            let p = box.previousElementSibling;
            while (p && window.getComputedStyle(p).display === "none") p = p.previousElementSibling;
            above = p;
            if (!above && box.parentElement) {
                let q = box.parentElement.previousElementSibling;
                while (q && window.getComputedStyle(q).display === "none") q = q.previousElementSibling;
                above = q;
            }
        }

        const drawsLine = !!(above && above.classList && above.classList.contains("section-title"));
        table.classList.toggle("line-above", drawsLine);

    });

    // Data-table cells that sit on the table's right edge. The table is
    // attached to the page frame, so these cells must not draw a right line of
    // their own. Measured, not "last-child": a merged cell can end a row early.
    root.querySelectorAll(".result-table-wrap .data-table").forEach((table) => {

        const tr = table.getBoundingClientRect();

        if (!tr.width) return;               // not laid out (view hidden) - keep the last marks

        table.querySelectorAll("th, td").forEach((cell) => {

            cell.classList.toggle("edge-right", Math.abs(cell.getBoundingClientRect().right - tr.right) < 1.5);

        });

    });

    // An approval cell that only holds leftovers from typing (a <br>, spaces)
    // is not :empty, so it lost its "Name / Sign / Date" hint while its
    // neighbours kept theirs. Clear such leftovers - but never in the cell being
    // typed in, which would move the caret.
    root.querySelectorAll(".approval-table td").forEach((td) => {

        if (td === document.activeElement) return;

        if (!td.textContent.trim() && !td.querySelector("img") && td.innerHTML !== "") td.innerHTML = "";

    });

}

// How far the rendered page sits off-centre inside its own canvas, in mm.
//
// html2canvas derives its crop from the element's bounding rect, which for a
// 210mm page is fractional (793.7008px). It floors the origin, so the page is
// drawn a few device pixels to the RIGHT and the same amount is clipped off the
// right edge. The result: a frame that is exactly centred on screen prints
// 11.1mm from the left paper edge but 9.2mm from the right.
//
// The offset is a pure translation - both frame lines move by the same amount -
// so it can be measured from the canvas and cancelled when the image is placed.
// Measuring beats a hard-coded nudge: the amount depends on the rounding, and a
// constant would be wrong on a different zoom, page size or device pixel ratio.
// The strip that gets trimmed is blank margin, so nothing is lost.
function pageOffsetMm(canvas){

    try {

        const W = canvas.width, H = canvas.height;
        if (!W || !H) return 0;

        const d = canvas.getContext("2d").getImageData(0, 0, W, H).data;

        // A column belonging to the page frame is dark down most of the page.
        const tall = Math.floor(H * 0.35);
        const darkCol = (x) => {
            let n = 0;
            for (let y = 0; y < H; y++) {
                const o = (y * W + x) * 4;
                if (d[o] + d[o + 1] + d[o + 2] < 330) n++;
            }
            return n;
        };

        let l = -1, r = -1;
        for (let x = 0; x < W; x++) if (darkCol(x) >= tall) { l = x; break; }
        for (let x = W - 1; x >= 0; x--) if (darkCol(x) >= tall) { r = x; break; }
        if (l < 0 || r <= l) return 0;                 // no frame found - leave it alone

        const off = ((l + r) / 2 - (W - 1) / 2) / W * 210;
        // Only correct a small slip. Anything larger is not this rounding and
        // shifting the page by it would make things worse.
        return Math.abs(off) <= 4 ? off : 0;

    } catch (e) { return 0; }                          // tainted canvas etc.

}

// Each .page element becomes exactly one PDF page.
//
// Letting html2pdf slice the whole report by height does not work here:
// two 297 mm pages come to 2245.8 px, the rendered canvas is 2246 px, and
// the extra fraction of a pixel rounds up into a third, near-empty page.
// Rendering page by page removes the rounding from the equation.
// A render that never settles must not leave the report stuck in its capture
// state - inert, every toolbar hidden, pdfBuilding true (which also disables
// the autosave) - with no message and no way back except a reload. The RCA
// build has had this guard for a while; the test report's had none, so a photo
// that failed to decode inside html2canvas's clone could hang it for good.
// A build that timed out keeps running in the background (html2canvas cannot be
// stopped). Starting another export on top of it rendered both at once and the
// second PDF came out with a grey double copy of the pages.
let pdfStraggler = null;

function pdfStillFinishing() {
    if (!pdfStraggler) return false;
    alert("The previous PDF is still finishing in the background. Please try again in a moment.");
    return true;
}

// Runs buildPdf with the time limit; on a time-out it remembers the build that
// is still running until it really ends.
function buildPdfLimited(what) {
    const build = buildPdf();
    return withTimeout(build, 180000, what).catch((err) => {
        if (err && /timed out/.test(err.message || "")) {
            const p = build.catch(() => {}).then(() => { if (pdfStraggler === p) pdfStraggler = null; });
            pdfStraggler = p;
        }
        throw err;
    });
}

function withTimeout(promise, ms, what) {
    let timer;
    const guard = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(what + " timed out - the report may be very large")), ms);
    });
    return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

async function buildPdf(){

    // Capture from the very top, so a scrolled window cannot offset the render.
    window.scrollTo(0, 0);

    // Photos marked "Grey" are swapped for grey copies just for the capture; the
    // colour originals go back in the finally below, even if this throws.
    const restoreColour = await greyPhotosForExport();

    try {

    const pages = Array.from(report.querySelectorAll(".page"));

    // Bootstrap a jsPDF instance.
    //
    // html2pdf bundles jsPDF as an internal module rather than exposing it, so
    // the only way to get an instance is to render something. Rendering
    // pages[0] here (as this used to) rasterised a full A4 page at scale 3 that
    // is then thrown away: it cost a whole extra render and left ~600 KB of
    // orphaned image data in the file, because deletePage drops the page but
    // not its image resource. A 10px seed does the same job for nothing.
    const seed = document.createElement("div");
    seed.style.cssText = "position:absolute;left:-9999px;top:0;width:10px;height:10px;background:#fff";
    document.body.appendChild(seed);

    let pdf;
    try {
        pdf = await html2pdf()

            .set({
                margin: 0,
                html2canvas: { scale: 1, backgroundColor: "#ffffff" },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
            })

            .from(seed)

            .toPdf()

            .get("pdf");
    } finally {
        seed.remove();
    }

    while (pdf.internal.getNumberOfPages() > 1) {

        pdf.deletePage(pdf.internal.getNumberOfPages());

    }

    // The bootstrap above already DREW page 1. addImage paints on top, it does
    // not replace, so page 1 used to carry two copies of the same image - dead
    // weight, and the moment the two are not pixel-identical (any re-centring,
    // or a re-render at a different scale) their frames print as double lines.
    // Every page is added fresh below and this leftover is dropped at the end.
    const bootstrapPage = 1;

    // Render EVERY page the same way: one full-page image placed at (0,0). Using
    // the same method for page 1 as the rest avoids html2pdf's slicing offset.
    for (let i = 0; i < pages.length; i++) {

        // Capture at the page's integer pixel size (210mm is a fractional
        // 793.7008px). This alone does NOT cancel the ~1mm rightward slip
        // html2canvas introduces - measured, the frame lands in exactly the same
        // pixels with or without it. That slip is measured from the canvas and
        // cancelled when the image is placed: see pageOffsetMm() below.
        // windowWidth/windowHeight are deliberately NOT set: overriding those
        // re-laid-out pages 2 and 3 and threw the frame right off.
        const canvas = await html2pdf()

            .set({ html2canvas: Object.assign({}, CANVAS_OPTIONS, {
                width: Math.round(pages[i].offsetWidth),
                height: Math.round(pages[i].offsetHeight)
            }) })

            .from(pages[i])

            .toCanvas()

            .get("canvas");

        // Always a FRESH page, so nothing is ever painted over the bootstrap
        // render (see above). The bootstrap page is removed after the loop.
        pdf.addPage();

        pdf.setPage(pdf.internal.getNumberOfPages());

        // Quality 1.0. At 0.98 JPEG ringing haloes every hairline, which reads
        // as lines of different colour and thickness on an otherwise clean page.
        // The x offset re-centres the frame - see pageOffsetMm().
        pdf.addImage(canvas.toDataURL("image/jpeg", 1.0), "JPEG",
                     -pageOffsetMm(canvas), 0, 210, 297);

    }

    pdf.deletePage(bootstrapPage);

    return pdf;

    } finally {
        // Colour photos back on screen, whatever happened above.
        restoreColour();
    }

}

// ===========================================
// PDF PREVIEW
// Shows the report as the real exported PDF - the same build as Export PDF,
// not an HTML look-alike - so margins, border, logo, page breaks and fonts
// can be checked before saving. Its Save button goes through exactly the same
// save path as the normal export, so saving from the preview IS the normal save.
// ===========================================

// One PDF build at a time. Export and Preview both hide the on-screen controls
// and restore them afterwards; overlapping builds would restore them mid-render
// and bake buttons into the PDF.
let pdfBuilding = false;

let activePdfPreview = null;

// The Word report's page border sits this many points OUTSIDE the text area
// (pgBorders offsetFrom="text"), i.e. on the 20 mm line where the PDF draws its
// frame. The .docx builder writes it and the Word preview draws it.
const WORD_FRAME_GAP_PT = 11;

// Ask where to save. Returns a file handle, "cancel" if the dialog was
// dismissed, or null when the browser has no save picker (Firefox / Safari),
// in which case writePdf() falls back to a normal download.
async function pickPdfHandle(filename){

    if (!window.showSaveFilePicker) return null;

    try {

        return await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: "PDF Document",
                accept: { "application/pdf": [".pdf"] }
            }]
        });

    } catch (err) {

        // The user closing the folder dialog is not an error.
        if (err && err.name === "AbortError") return "cancel";

        return null;

    }

}

async function writePdf(handle, blob, filename){

    if (handle && handle !== "cancel") {

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;

    }

    // No picker: a normal download, which honours the browser's
    // "Always ask you where to save files" setting.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);

}

// Opens the preview window at once with a "building" message and returns a
// controller: show(blob) when the PDF is ready, fail(message) if it is not.
// onSave(blob) runs when Save is pressed; an AbortError thrown from it means the
// user cancelled the save dialog, so the preview stays open.
// pdf.js (vendor/pdfjs) draws the preview pages. It is loaded only the first
// time a preview opens, so it costs nothing at start-up.
let pdfJsLoading = null;

// True when pdf.js has to run ON THE MAIN THREAD (a file:// page may not start a
// Web Worker). In that mode pdf.js 3.x needs script execution enabled; served over
// http(s) it runs in a real worker and we turn that off, so a crafted supplier PDF
// cannot run code in the page. See pdfSafeOpts().
function pdfFakeWorker() {
    try { return !/^https?:$/.test(location.protocol); } catch (e) { return true; }
}
function pdfSafeOpts(data) {
    const o = { data: data };
    if (!pdfFakeWorker()) o.isEvalSupported = false;
    return o;
}

function loadPdfJs(){

    if (window.pdfjsLib && (window.pdfjsWorker || !pdfFakeWorker())) return Promise.resolve(window.pdfjsLib);

    if (pdfJsLoading) return pdfJsLoading;

    const add = (src) => new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error("could not load " + src));
        document.head.appendChild(s);
    });

    // The worker script is loaded into the page as well. pdf.js then runs its
    // worker on the main thread instead of starting a Web Worker, which a
    // file:// page (how this app is often opened) is not allowed to do. A two
    // or three page report still renders in about a second.
    // Served over http(s): let pdf.js start a REAL worker, so the PDF is parsed
    // off the page and with script execution disabled (see pdfSafeOpts).
    pdfJsLoading = add("vendor/pdfjs/pdf.min.js")
        .then(() => (pdfFakeWorker() ? add("vendor/pdfjs/pdf.worker.min.js") : null))
        .then(() => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js";
            return window.pdfjsLib;
        })
        .catch((err) => { pdfJsLoading = null; throw err; });

    return pdfJsLoading;

}

// Draw every page of the PDF as a white A4 sheet on a grey background - the
// way a PDF viewer shows the downloaded file. It draws the exact bytes that
// Save writes, so what is seen is what is saved. Returns the page count.
async function renderPdfPages(blob, holder){

    const pdfjsLib = await loadPdfJs();

    const doc = await pdfjsLib.getDocument(pdfSafeOpts(new Uint8Array(await blob.arrayBuffer()))).promise;

    try {

        holder.innerHTML = "";

        const cssW = Math.min(900, Math.max(320, holder.clientWidth - 48));
        const ratio = Math.min(window.devicePixelRatio || 1, 2);   // sharp on hi-dpi screens

        for (let i = 1; i <= doc.numPages; i++) {

            const page = await doc.getPage(i);
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: (cssW / base.width) * ratio });

            const canvas = document.createElement("canvas");
            canvas.className = "pdfprev-page";
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            canvas.style.width = cssW + "px";
            canvas.setAttribute("role", "img");
            canvas.setAttribute("aria-label", "Page " + i + " of " + doc.numPages);
            holder.appendChild(canvas);

            await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;

        }

        return doc.numPages;

    } finally {

        doc.destroy();

    }

}

function openPdfPreview(filename, onSave){

    if (activePdfPreview) activePdfPreview.close();

    const wrap = document.createElement("div");
    wrap.className = "pdfprev";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "PDF preview");
    wrap.innerHTML =
        '<div class="pdfprev-box">' +
            '<div class="pdfprev-head">' +
                '<span class="pdfprev-title"><span class="pdfprev-name"></span><span class="pdfprev-count"></span></span>' +
                '<div class="pdfprev-actions">' +
                    '<button type="button" class="pdfprev-save" disabled>💾 Save PDF</button>' +
                    '<button type="button" class="pdfprev-x" title="Close (Esc)" aria-label="Close preview">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="pdfprev-body">' +
                '<div class="pdfprev-msg"><span class="spin"></span>' +
                    '<span class="pdfprev-msgtext">Building the preview — the same render as the downloaded PDF…</span></div>' +
                '<div class="pdfprev-pages" hidden></div>' +
                '<iframe class="pdfprev-frame" title="PDF preview" hidden></iframe>' +
            '</div>' +
            '<div class="pdfprev-foot"></div>' +
        '</div>';
    wrap.querySelector(".pdfprev-name").textContent = "👁 Preview — " + filename;
    document.body.appendChild(wrap);

    const saveBtn = wrap.querySelector(".pdfprev-save");
    const frame = wrap.querySelector(".pdfprev-frame");
    const pages = wrap.querySelector(".pdfprev-pages");
    const count = wrap.querySelector(".pdfprev-count");
    const msg = wrap.querySelector(".pdfprev-msg");
    const msgText = wrap.querySelector(".pdfprev-msgtext");
    const foot = wrap.querySelector(".pdfprev-foot");

    let blob = null, url = null, closed = false;

    function onKey(e){ if (e.key === "Escape") close(); }

    function close(){

        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey);
        if (url) URL.revokeObjectURL(url);
        wrap.remove();
        if (activePdfPreview === ctl) activePdfPreview = null;

    }

    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector(".pdfprev-x").addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {

        if (!blob) return;
        saveBtn.disabled = true;
        foot.className = "pdfprev-foot";
        foot.textContent = "";

        try {

            await onSave(blob);
            close();                       // saved - finishes like a direct save

        } catch (err) {

            if (!(err && err.name === "AbortError")) {
                foot.className = "pdfprev-foot err";
                foot.textContent = "Could not save the PDF: " + ((err && err.message) || err);
            }

        } finally {

            if (!closed) saveBtn.disabled = false;

        }

    });

    const ctl = {

        async show(b){

            if (closed) return;            // closed while it was still building
            blob = b;
            url = URL.createObjectURL(b);
            saveBtn.disabled = false;

            // Draw the pages ourselves, exactly as the downloaded file looks.
            // The browser's own embedded PDF viewer looked different from the
            // downloaded file and, in some browsers and embedded windows, showed
            // only an empty grey box.
            msgText.textContent = "Drawing the pages…";
            pages.hidden = false;

            try {

                const n = await renderPdfPages(b, pages);
                if (closed) return;
                msg.hidden = true;
                count.textContent = "  ·  " + n + (n === 1 ? " page" : " pages");
                saveBtn.focus();
                return;

            } catch (err) {

                if (closed) return;
                pages.hidden = true;
                pages.innerHTML = "";

            }

            // pdf.js could not load - fall back to the browser's PDF viewer.
            if (navigator.pdfViewerEnabled === false) {
                const spin = msg.querySelector(".spin");
                if (spin) spin.remove();
                msgText.innerHTML = "This browser cannot show a PDF inside the page. Press 💾 Save PDF, or " +
                    '<a target="_blank" rel="noopener">open the preview in a new tab</a>.';
                msgText.querySelector("a").href = url;
                return;
            }

            frame.src = url;
            frame.hidden = false;
            msg.hidden = true;
            saveBtn.focus();

        },

        fail(message){

            if (closed) return;
            const spin = msg.querySelector(".spin");
            if (spin) spin.remove();
            msg.classList.add("err");
            msgText.textContent = "Could not build the preview: " + message;

        },

        close: close

    };

    activePdfPreview = ctl;

    return ctl;

}

// JSZip + docx-preview (vendor/docx) draw the Word preview. Like pdf.js they
// are loaded only the first time a Word preview opens.
let docxLoading = null;

function loadDocxPreview(){

    if (window.docx && window.docx.renderAsync) return Promise.resolve(window.docx);

    if (docxLoading) return docxLoading;

    const add = (src) => new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error("could not load " + src));
        document.head.appendChild(s);
    });

    docxLoading = (window.JSZip ? Promise.resolve() : add("vendor/docx/jszip.min.js"))
        .then(() => add("vendor/docx/docx-preview.min.js"))
        .then(() => {
            if (!window.docx || !window.docx.renderAsync) throw new Error("the Word viewer did not load");
            return window.docx;
        })
        .catch((err) => { docxLoading = null; throw err; });

    return docxLoading;

}

// Draw a .docx the way Word shows it: white A4 sheets with the margins, the
// page border and the page breaks. docx-preview lays the whole document out as
// one long page and does not draw page borders, so the pages are cut here -
// between blocks and between table rows, never through a row, and a heading is
// moved along with what follows it (the file gives headings keepNext) - and the
// border is drawn WORD_FRAME_GAP_PT outside the text area, where Word puts it.
// It is drawn inside a shadow root, so none of the app's own styles (theme,
// colours, table rules) can reach the document. Returns the page count.
async function renderDocxPages(blob, holder){

    const docxLib = await loadDocxPreview();

    holder.innerHTML = "";

    const host = document.createElement("div");
    host.className = "pdfprev-docx";
    holder.appendChild(host);
    const root = host.attachShadow({ mode: "open" });

    const own = document.createElement("style");
    own.textContent =
        ":host{ all:initial; display:block; position:relative; }" +
        ".stage{ position:absolute; left:0; top:0; visibility:hidden; pointer-events:none; }" +
        ".stage > .docx-wrapper, .sheets.docx-wrapper{ display:block; background:none; padding:0; }" +
        ".sheet{ position:relative; margin:0 auto 18px; background:#fff; overflow:hidden;" +
            " box-shadow:0 2px 12px rgba(0,0,0,.5); }" +
        ".sheets.docx-wrapper > .sheet > section.docx{ position:absolute; left:0; top:0; margin:0;" +
            " box-shadow:none; background:#fff; transform-origin:0 0; }" +
        ".frame{ position:absolute; border:.5pt solid #000; pointer-events:none; z-index:2; }";

    const styles = document.createElement("div");
    const stage = document.createElement("div");
    stage.className = "stage";
    const sheets = document.createElement("div");
    sheets.className = "sheets docx-wrapper";     // docx-preview scopes its variables to .docx-wrapper
    root.append(own, styles, stage, sheets);

    await docxLib.renderAsync(blob, stage, styles, {
        className: "docx", inWrapper: true, breakPages: true,
        ignoreLastRenderedPageBreak: true, useBase64URL: true
    });

    // Pictures need their size before anything is measured.
    await Promise.all(Array.prototype.map.call(stage.querySelectorAll("img"), (im) =>
        (im.complete ? null : new Promise((res) => {
            im.addEventListener("load", res, { once: true });
            im.addEventListener("error", res, { once: true });
            setTimeout(res, 3000);
        }))));

    const px = (v) => parseFloat(v) || 0;
    const rows = (p) => Array.prototype.filter.call(p.children, (c) => c.tagName === "TR");
    const rowParent = (t) => t.querySelector(":scope > tbody") || t;
    const keepsNext = (el) => !!el && el.tagName === "P" && /(^|\s)docx_rca(sub)?heading(\s|$)/.test(el.className);

    const out = [];

    Array.prototype.slice.call(stage.querySelectorAll("section.docx")).forEach((sec) => {

        const cs = getComputedStyle(sec);
        const pad = { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };

        const probe = document.createElement("div");
        probe.style.height = sec.style.minHeight || "297mm";
        sec.parentNode.appendChild(probe);
        const pageH = probe.offsetHeight;
        probe.remove();
        const room = pageH - pad.t - pad.b;

        const queue = [];
        Array.prototype.forEach.call(sec.querySelectorAll(":scope > article"), (a) => {
            queue.push.apply(queue, Array.prototype.slice.call(a.children));
        });

        // The running header / footer repeat on every page, as in Word. docx-preview
        // gives them negative margins inside the page margins, so they take no
        // room from the text area.
        const hf = Array.prototype.filter.call(sec.children, (c) => c.tagName === "HEADER" || c.tagName === "FOOTER");
        // Word sets the header / footer out on a centre and a right tab stop;
        // docx-preview draws each tab as one em space, which bunched the three
        // parts together on the left. Lay them out as left | centre | right.
        hf.forEach((h) => Array.prototype.forEach.call(h.querySelectorAll("p"), (para) => {
            const parts = [[]], tabs = [];
            Array.prototype.slice.call(para.childNodes).forEach((n) => {
                if (n.nodeType === 1 && n.textContent === " ") { tabs.push(n); parts.push([]); }
                else parts[parts.length - 1].push(n);
            });
            if (parts.length !== 3) return;
            tabs.forEach((t) => t.remove());
            para.style.display = "flex";
            parts.forEach((nodes, i) => {
                const box = document.createElement("span");
                box.style.cssText = "flex:1 1 0;white-space:nowrap;text-align:" + ["left", "center", "right"][i];
                nodes.forEach((n) => box.appendChild(n));
                para.appendChild(box);
            });
        }));

        let art = null;
        const newPage = () => {
            const page = sec.cloneNode(false);
            page.style.minHeight = "0";
            hf.forEach((h) => { if (h.tagName === "HEADER") page.appendChild(h.cloneNode(true)); });
            art = document.createElement("article");
            page.appendChild(art);
            hf.forEach((h) => {
                if (h.tagName !== "FOOTER") return;
                // Word measures the footer distance to the BOTTOM of the footer
                // text, so the text belongs at the foot of its box - below the frame.
                const f = h.cloneNode(true);
                f.style.display = "flex";
                f.style.flexDirection = "column";
                f.style.justifyContent = "flex-end";
                page.appendChild(f);
            });
            sec.parentNode.insertBefore(page, sec);
            out.push({ page: page, pad: pad, h: pageH });
        };
        const fits = () => art.offsetHeight <= room + 1;

        // The block that did not fit starts the next page, taking along any
        // heading that would otherwise be left alone at the foot of this one.
        const carryOver = (el) => {
            const carry = [el];
            while (art.children.length > 1 && keepsNext(art.lastElementChild)) {
                carry.unshift(art.removeChild(art.lastElementChild));
            }
            newPage();
            queue.unshift.apply(queue, carry);
        };

        newPage();

        while (queue.length) {

            const el = queue.shift();
            art.appendChild(el);
            if (fits()) continue;

            const src = el.tagName === "TABLE" ? rowParent(el) : null;

            // A table that fits on a page moves down whole (the file keeps its
            // rows together); only a table taller than a page is split.
            if (src && art.children.length > 1 && el.offsetHeight <= room) {
                art.removeChild(el);
                carryOver(el);
                continue;
            }

            if (src && rows(src).length > 1) {
                // Fill this page row by row; the rest of the table continues on the next.
                const part = el.cloneNode(false);
                Array.prototype.forEach.call(el.querySelectorAll(":scope > colgroup"), (cg) => part.appendChild(cg.cloneNode(true)));
                const dst = src === el ? part : part.appendChild(src.cloneNode(false));
                art.replaceChild(part, el);
                let placed = 0;
                for (const tr of rows(src)) {
                    dst.appendChild(tr);
                    if (fits() || (placed === 0 && art.children.length === 1)) { placed++; continue; }
                    src.insertBefore(tr, rows(src)[0] || null);
                    break;
                }
                if (placed) {
                    if (rows(src).length) { newPage(); queue.unshift(el); }
                    continue;
                }
                art.removeChild(part);
                carryOver(el);
                continue;
            }

            if (art.children.length === 1) continue;       // taller than a page on its own
            art.removeChild(el);
            carryOver(el);

        }

        sec.remove();

    });

    // These sheets are fixed-size boxes (a canvas page can shrink with
    // max-width, these cannot), so on a narrow screen use the whole width.
    const avail = holder.clientWidth;
    const cssW = Math.min(900, Math.max(200, avail < 600 ? avail - 4 : avail - 48));
    const gap = (WORD_FRAME_GAP_PT + 0.5) + "pt";

    out.forEach((p, idx) => {

        const scale = cssW / p.page.offsetWidth;
        p.page.style.height = p.h + "px";

        // docx-preview does not work out PAGE / NUMPAGES fields: write them in.
        const foot = p.page.querySelector("footer");
        if (foot) {
            const walk = document.createTreeWalker(foot, NodeFilter.SHOW_TEXT);
            const texts = [];
            while (walk.nextNode()) texts.push(walk.currentNode);
            texts.forEach((n) => {
                if (/Page\s*$/.test(n.data)) n.data = n.data.replace(/\s*$/, " " + (idx + 1));
                else if (/^\s*of\s*$/.test(n.data)) n.data = " of " + out.length;
            });
        }

        // Word drops the space above the first paragraph of a page.
        const first = p.page.querySelector("article > :first-child");
        if (first && first.tagName === "P") first.style.marginTop = "0";

        const fr = document.createElement("div");
        fr.className = "frame";
        fr.style.left = "calc(" + p.pad.l + "px - " + gap + ")";
        fr.style.right = "calc(" + p.pad.r + "px - " + gap + ")";
        fr.style.top = "calc(" + p.pad.t + "px - " + gap + ")";
        fr.style.bottom = "calc(" + p.pad.b + "px - " + gap + ")";
        p.page.appendChild(fr);

        const sheet = document.createElement("div");
        sheet.className = "sheet";
        sheet.setAttribute("role", "img");
        sheet.setAttribute("aria-label", "Page " + (out.indexOf(p) + 1) + " of " + out.length);
        sheet.style.width = cssW + "px";
        sheet.style.height = Math.round(p.h * scale) + "px";
        p.page.style.transform = "scale(" + scale + ")";
        sheet.appendChild(p.page);
        sheets.appendChild(sheet);

    });

    stage.remove();

    return out.length;

}

// A preview window with one tab per file format - the RCA report offers PDF and
// Word. A tab builds its file the first time it is opened (the very same build
// as that format's download button), draws that file the way its own viewer
// shows it, and its Save button writes exactly those bytes.
// formats: [{ key, tab, what, filename, saveText,
//             build() -> Promise<Blob>, draw(blob, holder) -> Promise<pages>, save(blob) }]
// save() throwing an AbortError means the save dialog was cancelled.
function openTabbedPreview(formats, startKey){

    if (activePdfPreview) activePdfPreview.close();

    const wrap = document.createElement("div");
    wrap.className = "pdfprev";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "File preview");
    wrap.innerHTML =
        '<div class="pdfprev-box">' +
            '<div class="pdfprev-head">' +
                '<span class="pdfprev-title"><span class="pdfprev-name"></span><span class="pdfprev-count"></span></span>' +
                '<div class="pdfprev-tabs" role="tablist" aria-label="File format"></div>' +
                '<div class="pdfprev-actions">' +
                    '<button type="button" class="pdfprev-save" disabled>💾 Save</button>' +
                    '<button type="button" class="pdfprev-x" title="Close (Esc)" aria-label="Close preview">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="pdfprev-body">' +
                '<div class="pdfprev-msg"><span class="spin"></span><span class="pdfprev-msgtext"></span></div>' +
                '<div class="pdfprev-pages" hidden></div>' +
            '</div>' +
            '<div class="pdfprev-foot"></div>' +
        '</div>';
    document.body.appendChild(wrap);

    const q = (s) => wrap.querySelector(s);
    const nameEl = q(".pdfprev-name"), count = q(".pdfprev-count"), tabsEl = q(".pdfprev-tabs");
    const saveBtn = q(".pdfprev-save"), pages = q(".pdfprev-pages"), foot = q(".pdfprev-foot");
    const msg = q(".pdfprev-msg"), spin = q(".pdfprev-msg .spin"), msgText = q(".pdfprev-msgtext");

    const built = {};                  // key -> Promise<Blob>, built once per window
    let queue = Promise.resolve();     // one build at a time: each one reads and restyles the live report
    let current = null, blob = null, token = 0, closed = false;

    function say(text, working, isErr){
        msg.hidden = false;
        msg.classList.toggle("err", !!isErr);
        spin.style.display = working ? "" : "none";
        msgText.textContent = text;
    }

    function onKey(e){ if (e.key === "Escape") close(); }

    function close(){
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey);
        wrap.remove();
        if (activePdfPreview === ctl) activePdfPreview = null;
    }

    const tabs = formats.map((f) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pdfprev-tab";
        b.setAttribute("role", "tab");
        b.textContent = f.tab;
        b.addEventListener("click", () => { if (current !== f) select(f.key); });
        tabsEl.appendChild(b);
        return b;
    });

    async function select(key){

        const f = formats.find((x) => x.key === key);
        if (!f || closed) return;
        const my = ++token;
        current = f;
        blob = null;

        tabs.forEach((b, i) => {
            const on = formats[i] === f;
            b.classList.toggle("on", on);
            b.setAttribute("aria-selected", on ? "true" : "false");
        });
        nameEl.textContent = "👁 Preview — " + f.filename;
        count.textContent = "";
        saveBtn.textContent = f.saveText;
        saveBtn.disabled = true;
        foot.className = "pdfprev-foot";
        foot.textContent = "";
        pages.hidden = true;
        pages.innerHTML = "";
        say("Building the " + f.what + " — the same file the download saves…", true);

        try {

            if (!built[key]) {
                const run = queue.catch(() => {}).then(() => f.build());
                queue = run;
                built[key] = run;
                run.catch(() => { if (built[key] === run) delete built[key]; });   // a failed build can be retried
            }
            const b = await built[key];
            if (my !== token || closed) return;

            blob = b;
            saveBtn.disabled = false;
            say("Drawing the pages…", true);
            const view = document.createElement("div");
            pages.appendChild(view);
            pages.hidden = false;

            const n = await f.draw(b, view);
            if (my !== token || closed) return;
            msg.hidden = true;
            count.textContent = "  ·  " + n + (n === 1 ? " page" : " pages");
            saveBtn.focus();

        } catch (err) {

            if (my !== token || closed) return;
            pages.hidden = true;
            const why = (err && err.message) || String(err);
            say(blob ? "Could not draw the preview (" + why + "). 💾 Save still saves the file."
                     : "Could not build the " + f.what + ": " + why, false, true);

        }

    }

    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    q(".pdfprev-x").addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {

        if (!blob || !current) return;
        const f = current, b = blob;
        saveBtn.disabled = true;
        foot.className = "pdfprev-foot";
        foot.textContent = "";

        try {
            await f.save(b);
            close();                       // saved - finishes like a direct save
        } catch (err) {
            if (!(err && err.name === "AbortError")) {
                foot.className = "pdfprev-foot err";
                foot.textContent = "Could not save the " + f.what + ": " + ((err && err.message) || err);
            }
        } finally {
            if (!closed && current === f && blob) saveBtn.disabled = false;
        }

    });

    const ctl = { close: close, select: select };

    activePdfPreview = ctl;

    select(startKey || formats[0].key);

    return ctl;

}

// "👁 Preview" in the test report's toolbar, next to Export PDF. (It first sat
// in the logo box, but that box is only ~100px wide and the button covered the
// logo.)
async function previewPDF(){

    if (pdfBuilding || pdfStillFinishing()) return;
    if (obsCorrecting) { alert("Please wait - Correct English is still rewriting the Observation."); return; }

    pdfBuilding = true;

    const filename = buildFilename();

    // Saving from the preview is the same as Export PDF: same picker, same name.
    const view = openPdfPreview(filename, async (blob) => {

        const handle = await pickPdfHandle(filename);

        if (handle === "cancel") {
            const stop = new Error("cancelled");
            stop.name = "AbortError";
            throw stop;
        }

        await writePdf(handle, blob, filename);

    });

    try {

        // INSIDE the try - same reason as exportPDF().
        report.classList.add("exporting");

        hideScreenOnly(true);

        const pdf = await buildPdfLimited("Building the preview");

        view.show(pdf.output("blob"));

    } catch (err) {

        view.fail(err && err.message ? err.message : String(err));

    } finally {

        hideScreenOnly(false);

        report.classList.remove("exporting");

        pdfBuilding = false;

    }

}

async function exportPDF(){

    const btn = document.getElementById("downloadPDF");

    const filename = buildFilename();

    if (pdfBuilding || pdfStillFinishing()) return;
    if (obsCorrecting) { alert("Please wait - Correct English is still rewriting the Observation."); return; }

    // Ask WHERE to save first, while this still counts as the user's click.
    // Opening the picker only after the render (as this used to) risks the
    // browser refusing it: the scale-3 render takes seconds, and by then the
    // click no longer counts. The RCA export already works this way.
    const handle = await pickPdfHandle(filename);

    if (handle === "cancel") return;

    pdfBuilding = true;

    btn.disabled = true;

    try {

        // INSIDE the try: anything these throw must still reach the finally,
        // or the report stays inert with its toolbars hidden and pdfBuilding
        // stuck true, which also disables the autosave.
        report.classList.add("exporting");

        hideScreenOnly(true);

        const pdf = await buildPdfLimited("Building the PDF");

        await writePdf(handle, pdf.output("blob"), filename);

    } catch (err) {

        // The user closing the folder dialog is not an error.
        if (err && err.name !== "AbortError") {

            alert("Could not export the PDF: " + err.message);

        }

    } finally {

        hideScreenOnly(false);

        report.classList.remove("exporting");

        btn.disabled = false;

        pdfBuilding = false;

    }

}

// ===========================================
// PAGE FIT CHECK
// The pages are a fixed 297 mm tall. If content grows past that it
// would be silently clipped, so flag it instead of hiding it.
// ===========================================

// Auto-fit: if a page's content is taller than the page, shrink it just enough
// to fit (down to a floor), so the report always stays 2 clean pages instead of
// clipping. Only warns if it is still too tall after the maximum shrink.
const FIT_FLOOR = 0.55;   // never shrink below 55%

function checkPageFit(){

    // Runs after every change to the report (sections, photos, tables, typing).
    // First spread the sections over as many pages as they need, then set the
    // rules above section bars so the screen always matches the PDF.
    reflowPages();

    markBarRules();

    document.querySelectorAll(".page").forEach((page, i) => {

        const old = page.querySelector(".page-warning");
        if (old) old.remove();

        const inner = page.querySelector(":scope > .page-inner");
        const fit = inner ? inner.querySelector(":scope > .page-fit") : null;

        // Skip pages that are not visible (e.g. when another view is showing) -
        // their clientHeight is 0 and would trigger a bogus shrink.
        if (inner && inner.clientHeight === 0) return;

        let overflowing = false;

        if (inner && fit) {

            // Reset any previous scaling so we measure the natural height.
            fit.style.width = "";
            fit.style.transform = "";
            fit.style.transformOrigin = "";

            const avail = inner.clientHeight;
            const natural = fit.scrollHeight;

            if (natural > avail + 1) {

                let scale = Math.max(FIT_FLOOR, avail / natural);

                // Widen the content so that after scaling it still fills the page
                // width, then scale it down to fit the height.
                fit.style.transformOrigin = "top left";
                fit.style.width = (100 / scale) + "%";
                fit.style.transform = "scale(" + scale + ")";

                // Still too tall only if we hit the shrink floor.
                overflowing = (fit.scrollHeight * scale) > avail + 4;

            }

        } else {
            overflowing = page.scrollHeight > page.clientHeight + 1;
        }

        page.classList.toggle("overflow", overflowing);

        if (overflowing) {

            const warn = document.createElement("div");
            warn.className = "page-warning";
            warn.textContent =
                `Page ${i + 1}: one section is longer than a whole page - consider shortening its text.`;
            page.appendChild(warn);

        }

    });

}

// Not while a PDF is being built: the capture has its own page layout, and
// re-flowing the pages mid-render would drop or blank a page.
document.addEventListener("input", () => { if (!pdfBuilding) checkPageFit(); });
window.addEventListener("resize", () => { if (!pdfBuilding) checkPageFit(); });

// ===========================================
// MORE PAGES
// The report is not limited to two pages.
//  * Automatic: when a page is full, its last sections move onto a new A4 page
//    straight after it - same header, frame and margins - instead of being
//    shrunk, and they move back as soon as there is room again.
//  * Manual: "➕ Add Page" adds a page with its own editable section.
// Sections always move whole, never cut in two. They keep their ids, so saving,
// loading and the PDF work exactly as before (every .page is one PDF page).
// ===========================================

function pageFitOf(page){

    const inner = page && page.querySelector(":scope > .page-inner");

    return inner ? inner.querySelector(":scope > .page-fit") : null;

}

// Everything on a page that may move to another page: the sections, not the header.
function flowBlocks(fit){

    return Array.prototype.filter.call(fit.children, (c) => !c.classList.contains("header-card"));

}

// How many blocks on a page are actually SEEN. Hidden blocks (the empty extra
// photo card, the "+ Add section" rows) take no room and must not count as
// content, or a page could be left holding nothing but a hidden block.
function visibleFlowCount(fit){

    return flowBlocks(fit).filter((b) => flowHeight(b) > 0).length;

}

// Height a block takes in the page, margins included (0 when hidden). offsetHeight,
// not getBoundingClientRect: the screen zoom scales the latter.
function flowHeight(el){

    const cs = window.getComputedStyle(el);

    if (cs.display === "none") return 0;

    return el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);

}

// A read-only copy of THE header (the one at the top of the report) for every
// page after the first. Its ids are removed, so it can never be mistaken for
// the real fields, and so are the things that only make sense on the real one:
// typing, the Upload Logo / Adjust buttons and the file input behind them.
function headerMirror(){

    const src = document.getElementById("revision");
    const card = src ? src.closest(".header-card") : null;

    if (!card) return document.createElement("div");

    const h = card.cloneNode(true);
    h.classList.add("header-mirror");
    h.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    h.querySelectorAll("[contenteditable]").forEach((e) => e.removeAttribute("contenteditable"));
    h.querySelectorAll("button, input").forEach((e) => e.remove());
    h.dataset.sig = headerSignature();          // what this copy shows

    return h;

}

// Report No., Rev, date and logo of the real header, as one comparable string.
function headerSignature(){

    const logo = document.getElementById("companyLogo");

    return ["revision", "reportNo", "reportDate"].map((id) => {
        const el = document.getElementById(id);
        return el ? el.innerText.trim() : "";
    }).concat(logo ? [logo.src.length, logo.src.slice(-80), logo.style.cssText] : []).join("|");

}

// Keep every later page's header the same as the real one (report no., date, logo).
// Each copy remembers what it shows, so a copy made at any time is compared on
// its own - one shared "last value" could miss a change back to an old value
// and leave an old Report No. on an added page.
function syncHeaderMirrors(){

    const sig = headerSignature();

    document.querySelectorAll("#report .header-card.header-mirror").forEach((h) => {
        if (h.dataset.sig !== sig) h.replaceWith(headerMirror());
    });

}

function newFlowPage(kind){

    const page = document.createElement("div");
    page.className = "page " + kind;

    // Created during a PDF capture: take the capture's A4 layout like the others.
    if (document.querySelector("#report > .page.print-layout")) page.classList.add("print-layout");

    const inner = document.createElement("div");
    inner.className = "page-inner";

    const fit = document.createElement("div");
    fit.className = "page-fit";

    fit.appendChild(headerMirror());
    inner.appendChild(fit);
    page.appendChild(inner);

    return page;

}

// ---- the report's closing sections ----
// Conclusion and Approval sign the report off, so they always belong at the
// END: the last blocks on the LAST page, whatever is added before them (photos
// that spill onto continuation pages, or a page added with "➕ Add Page").
const TAIL_CARD_IDS = ["conclusionCard", "recommendationCard", "approvalCard", "approvalRestore"];

function tailCards(){

    return TAIL_CARD_IDS.map((id) => document.getElementById(id)).filter(Boolean);

}

// Already the last blocks of this page, in this order?
function tailSettled(fit, cards){

    const kids = Array.prototype.slice.call(fit.children, -cards.length);

    return kids.length === cards.length && cards.every((c, i) => kids[i] === c);

}

// Puts the closing sections at the foot of one page. True when something moved.
function moveTailTo(fit){

    const cards = tailCards();

    if (!fit || !cards.length || tailSettled(fit, cards)) return false;

    cards.forEach((c) => fit.appendChild(c));

    return true;

}

// The last page of the report: a page added by hand, a continuation page, or
// the built-in page 2 when nothing was added.
function lastReportPage(){

    const root = document.getElementById("report");

    if (!root) return null;

    const pages = root.querySelectorAll(":scope > .page");

    return pages.length ? pages[pages.length - 1] : null;

}

// The last page that is part of the report itself and can never be deleted.
// The closing sections are parked here before added pages go away.
function lastBuiltInPage(){

    const root = document.getElementById("report");

    if (!root) return null;

    const pages = Array.prototype.filter.call(root.children, (p) =>
        p.classList.contains("page") &&
        !p.classList.contains("page-auto") &&
        !p.classList.contains("page-manual"));

    return pages.length ? pages[pages.length - 1] : null;

}

function tailToLastPage(){

    return moveTailTo(pageFitOf(lastReportPage()));

}

// The page holding the closing sections is laid out as a column with the
// Conclusion pushed down (CSS `.page-fit.tail-page`), so Conclusion and
// Approval sit ON the bottom margin and the white space is above them.
// The mark is a CLASS, not an inline style: a class survives html2canvas's
// clone, so the PDF is pinned exactly like the screen.
function clearTailPageMark(){

    document.querySelectorAll("#report .page-fit.tail-page")
        .forEach((f) => f.classList.remove("tail-page"));

}

function markTailPage(){

    const card = document.getElementById("conclusionCard");
    const fit = card ? card.closest(".page-fit") : null;

    if (fit) fit.classList.add("tail-page");

}

// NOTE: the white space above the pinned sections does NOT change the rules.
// The section above it drops its bottom border as everywhere else (markBarRules
// / .bar-below) and the Conclusion heading's own top rule introduces the block:
// keeping both printed as ONE thick line (probe18 measured y1382 h8) and broke
// the house rule of exactly one rule above a heading.

// Spread every page's sections over as many A4 pages as they need.
function reflowPages(){

    const root = document.getElementById("report");

    if (!root) return;

    // Everything below is measured in plain block layout: the bottom-pinned
    // page is a flex column with min-height 100%, which would report a full
    // page however little is on it and stop sections moving back up a page.
    clearTailPageMark();

    // The closing sections go to the last page BEFORE anything is measured, so
    // the overflow handling below treats them like any other block (if they no
    // longer fit, they move on to a continuation page and are still last).
    tailToLastPage();

    const owners = Array.prototype.filter.call(root.children,
        (p) => p.classList.contains("page") && !p.classList.contains("page-auto"));

    const firstFit = pageFitOf(owners[0]);

    // Not on screen (another view is showing): nothing can be measured.
    if (!firstFit || !firstFit.parentElement.clientHeight) return;

    syncHeaderMirrors();

    // A page may run a little over its height: checkPageFit scales a page that
    // does by that much, and a 4% shrink is not visible. Without the allowance
    // a section that missed by a few pixels - the photo block misses a blank
    // report's first page by 5px - was pushed onto a page of its own, leaving
    // most of the page before it blank. Sections pack tightly now.
    const SQUEEZE = 1.04;

    const room = (fit) => fit.parentElement.clientHeight;
    const capacity = (fit) => room(fit) * SQUEEZE;
    const over = (fit) => fit.scrollHeight > capacity(fit) + 1;

    // Moving the section being typed in must not lose the caret.
    const active = document.activeElement;
    const sel = window.getSelection();
    let caret = null;
    try {
        if (sel && sel.rangeCount) {
            const r = sel.getRangeAt(0);
            caret = [r.startContainer, r.startOffset, r.endContainer, r.endOffset];
        }
    } catch (e) { caret = null; }

    let moved = false, pagesChanged = false;

    owners.forEach((owner) => {

        const ownFit = pageFitOf(owner);

        if (!ownFit) return;

        const chain = [ownFit];

        for (let n = owner.nextElementSibling; n && n.classList.contains("page-auto"); n = n.nextElementSibling) {
            chain.push(pageFitOf(n));
        }

        // Measure at full size (checkPageFit may have scaled a page earlier).
        chain.forEach((f) => { f.style.width = ""; f.style.transform = ""; f.style.transformOrigin = ""; });

        // Already right? No page overflows (unless it holds a single section
        // taller than a page) and no section could move back up a page.
        const settled = chain.every((f, i) => {
            if (over(f)) return visibleFlowCount(f) <= 1;
            const next = chain[i + 1];
            if (!next) return true;
            const b = flowBlocks(next).find((x) => flowHeight(x) > 0);
            if (!b) return false;                         // a continuation page with nothing to show
            return f.scrollHeight + flowHeight(b) > capacity(f) - 2;
        });

        if (settled) return;

        // Pull every section back onto its own page, then push the overflow out.
        const pool = chain.slice(1).map((f) => f.closest(".page"));

        chain.slice(1).forEach((f) => flowBlocks(f).forEach((b) => { ownFit.appendChild(b); moved = true; }));

        let cur = ownFit, last = owner, used = 0;

        while (over(cur) && visibleFlowCount(cur) > 1) {

            let page = pool[used];

            if (!page) { page = newFlowPage("page-auto"); pagesChanged = true; }

            if (last.nextElementSibling !== page) last.after(page);

            used++;

            const fit = pageFitOf(page);

            while (over(cur) && visibleFlowCount(cur) > 1) {

                const blocks = flowBlocks(cur);
                const last = blocks[blocks.length - 1];
                const anchor = flowBlocks(fit)[0] || null;

                // Conclusion and Approval move as ONE block. Pushed one at a
                // time, a page that fits again once the Approval table has left
                // stranded it alone at the top of the last page while the
                // Conclusion kept the pinned gap on the page before it.
                // Except when the page already holds NOTHING but that group and
                // it is still taller than the page (a very long Conclusion):
                // moving it whole would just overflow the next page the same
                // way, for ever. Then it is split like any other sections.
                const tailOnly = flowBlocks(cur).every((b) =>
                    flowHeight(b) === 0 || TAIL_CARD_IDS.indexOf(b.id) >= 0);
                if (TAIL_CARD_IDS.indexOf(last.id) >= 0 && !tailOnly) {
                    tailCards()
                        .filter((c) => c.parentElement === cur)
                        .forEach((c) => fit.insertBefore(c, anchor));
                } else {
                    fit.insertBefore(last, anchor);
                }

                moved = true;

            }

            cur = fit;
            last = page;

        }

        pool.slice(used).forEach((p) => { p.remove(); pagesChanged = true; });

    });

    if (moved && active && active !== document.body && document.contains(active)) {
        try {
            active.focus({ preventScroll: true });
            if (caret && document.contains(caret[0]) && document.contains(caret[2])) {
                const r = document.createRange();
                r.setStart(caret[0], caret[1]);
                r.setEnd(caret[2], caret[3]);
                sel.removeAllRanges();
                sel.addRange(r);
            }
        } catch (e) { /* the caret is best effort */ }
    }

    if (pagesChanged && typeof window.reapplyWatermark === "function") window.reapplyWatermark();

    // Every move is done: pin the closing sections to the foot of the page they
    // ended up on.
    markTailPage();

}

// ---- ➕ Add Page ----
const MANUAL_PAGES_KEY = "manualPages";

function manualPageIds(){

    try {
        const a = JSON.parse(localStorage.getItem(MANUAL_PAGES_KEY) || "[]");
        return Array.isArray(a) ? a.filter((n) => Number.isInteger(n)) : [];
    } catch (e) { return []; }

}

// The pages added by hand that are ON SCREEN right now.
function manualPagesOnScreen(){

    return Array.prototype.map.call(
        document.querySelectorAll("#report > .page-manual"),
        (p) => parseInt(p.dataset.manual, 10)
    ).filter((n) => Number.isInteger(n));

}

// Stores that list. It is always rewritten from the screen, never appended to:
// appending left a page that belongs to the DRAFT (and so is not on screen
// after the blank start-up) registered, and the next Load Draft brought it back
// as an unexpected extra page carrying old text.
function saveManualPageList(){
    bindFreshDraft();

    try { localStorage.setItem(MANUAL_PAGES_KEY, JSON.stringify(manualPagesOnScreen())); }
    catch (e) { warnStorageFull("the added pages"); }

}

function buildManualPage(n){

    const page = newFlowPage("page-manual");
    page.dataset.manual = String(n);

    const card = document.createElement("div");
    card.className = "section-card manual-section";
    card.innerHTML =
        '<div class="section-title">' +
            '<span><span class="manual-title" contenteditable="true" id="manualTitle' + n + '" data-placeholder="Section title">Additional Information</span></span>' +
            '<button type="button" class="auto-btn approval-remove" onclick="removeManualPage(this)">✕ Remove page</button>' +
        "</div>" +
        '<div class="editor manual-box" contenteditable="true" id="manualBody' + n + '" data-placeholder="Type or paste text, a table or a picture for this page."></div>';

    pageFitOf(page).appendChild(card);
    document.getElementById("report").appendChild(page);

    return page;

}

function addManualPage(){

    // An id no page is using - on screen OR in the draft, so a page restored
    // later can never collide with this one.
    const ids = manualPageIds();
    const n = ids.length ? Math.max.apply(null, ids) + 1 : 1;

    const page = buildManualPage(n);

    saveManualPageList();

    if (typeof window.reapplyWatermark === "function") window.reapplyWatermark();

    checkPageFit();
    saveIfChanged();        // keeps the skipUnloadSave / export guards

    page.scrollIntoView({ behavior: "smooth", block: "start" });
    const box = page.querySelector(".manual-box");
    if (box) box.focus({ preventScroll: true });

}

function removeManualPage(btn){

    const page = btn.closest(".page");

    if (!page || !confirm("Remove this page and everything on it?")) return;

    const n = parseInt(page.dataset.manual, 10);

    // The closing sections belong to the report, never to the page being
    // removed; checkPageFit() below puts them on the new last page.
    moveTailTo(pageFitOf(lastBuiltInPage()));

    for (let x = page.nextElementSibling; x && x.classList.contains("page-auto"); ) {
        const nx = x.nextElementSibling;
        x.remove();
        x = nx;
    }

    page.remove();

    saveManualPageList();

    try {
        localStorage.removeItem("manualTitle" + n);
        localStorage.removeItem("manualBody" + n);
    } catch (e) { /* ignore */ }

    if (typeof window.reapplyWatermark === "function") window.reapplyWatermark();

    checkPageFit();

}

// Back to the two built-in pages: sections on automatic pages return to their
// own page, and pages added by hand are removed.
function removeAllAddedPages(){

    const root = document.getElementById("report");

    if (!root) return;

    root.querySelectorAll(":scope > .page-auto").forEach((p) => {
        let owner = p.previousElementSibling;
        while (owner && owner.classList.contains("page-auto")) owner = owner.previousElementSibling;
        const fit = pageFitOf(owner);
        if (fit) flowBlocks(pageFitOf(p)).forEach((b) => fit.appendChild(b));
        p.remove();
    });

    // Conclusion / Approval may be sitting on a page that is about to go: park
    // them on the report's own last page or they would be deleted with it.
    moveTailTo(pageFitOf(lastBuiltInPage()));

    root.querySelectorAll(":scope > .page-manual").forEach((p) => p.remove());

}

// Load Draft / opening a saved report: rebuild the pages that were added by hand.
function restoreManualPages(){

    removeAllAddedPages();

    manualPageIds().forEach(buildManualPage);

    // Straight away, so the report never flashes with Conclusion / Approval in
    // the middle before the next checkPageFit().
    tailToLastPage();

    // The rebuilt pages need the watermark too (they had none after Load Draft
    // or opening a saved report).
    if (typeof window.reapplyWatermark === "function") window.reapplyWatermark();

}

document.getElementById("addPage").addEventListener("click", addManualPage);


// ===========================================
// TEST TEMPLATES
//
// Each template supplies everything the Auto buttons need for one kind of
// test: the standard, the hazard the test challenges, the procedure steps in
// plain language, and the reason clauses used to build the conclusion.
//
// steps: [duration in minutes, plain-English action]
// ===========================================


// ===========================================
// TEST TEMPLATES
//
// The procedure describes only what the sample is subjected to: the test
// condition and how long it is applied. Inspection, photographs and report
// preparation are workflow, not procedure, and the report already has its own
// sections for them.
//
// procedure: an array of wordings; each Auto press steps to the next one.
//            Every wording is a short list of plain points.
//            {n} is replaced by the product noun ("motor", "battery pack"...).
// ===========================================

const PROCEDURE_TEMPLATES = [

    // ---- Helmet (IS 4151 / ECE 22.06) ----
    // These come FIRST so helmet tests stop inheriting battery, adhesive-tape or
    // eyewear procedures: "Penetration Resistance" used to print the battery nail
    // test, and "Chin Strap Elongation" the adhesive-tape tensile test.
    {
        match: { test: (s) => /impact\s*(absorption|attenuation)|shock\s*absorption\s*(test|capacity)|helmet.*impact/i.test(s) &&
            !/suspension|absorber|damper|\bfork\b|mount|\bseat|packag|\bsole\b|shoe|glove|bumper|buffer/i.test(s) },
        standard: "IS 4151 / ECE 22.06 (Impact absorption)",
        hazard: "head injury because the shell and liner do not absorb the impact energy",
        reasonPass: "the peak acceleration transmitted to the headform stayed below the specified limit at every impact point",
        reasonFail: "the acceleration transmitted to the headform exceeded the limit, resulting in {n} rejection",
        procedure: [[
            "The {n} is conditioned (ambient, high and low temperature, and wet) and fitted to the specified headform on the drop-test rig.",
            "It is dropped in guided free fall onto the flat and kerbstone anvils at the specified impact velocity, at each defined impact point.",
            "The acceleration of the headform is recorded against time for every impact.",
            "The peak acceleration (and where required the HIC value) is compared with the limit in the standard."
        ]]
    },

    {
        match: /retention\s*system|chin\s*strap|strap\s*(strength|slip|elongation)|quick[\s-]?release\s*buckle|(helmet|strap|chin|buckle).{0,20}quick[\s-]?release/i,
        standard: "IS 4151 / ECE 22.06 (Retention system strength & slippage)",
        hazard: "the helmet coming off, or the strap tearing or stretching, during a crash",
        reasonPass: "the retention system held the load with the dynamic elongation and permanent residual elongation within the specified limits, and the buckle released afterwards",
        reasonFail: "the strap broke, slipped or stretched beyond the limit, or the buckle would not release, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted on the headform and its retention system fastened as it would be worn.",
            "A pre-load is applied to the chin strap, the reference position is recorded, and the specified test mass is dropped in guided fall to load the strap dynamically.",
            "The maximum (dynamic) elongation during the test and the residual elongation after it are measured.",
            "Both values, the condition of the strap and buckle, and the release force of the quick-release are compared with the limits."
        ]]
    },

    {
        match: /roll[\s-]?off|off[\s-]?head|helmet\s*stability|helmet.{0,20}dynamic\s*stability/i,
        standard: "IS 4151 / ECE 22.06 (Roll-off / dynamic stability)",
        hazard: "the helmet rolling off the head before or during the impact",
        reasonPass: "the {n} stayed on the headform through the specified forward and rearward roll-off loading",
        reasonFail: "the {n} rolled off the headform, resulting in rejection",
        procedure: [[
            "The {n} is fitted to the headform in its correct position and the retention system is fastened.",
            "A hook and cord are attached to the rear edge and the specified mass is dropped to load it forwards.",
            "The test is repeated at the front edge to load the helmet rearwards.",
            "It is recorded whether the helmet came off the headform in either direction."
        ]]
    },

    {
        match: /shell\s*penetrat|striker\s*(penetrat|drop)|helmet.*penetrat|penetrat.*helmet/i,
        standard: "IS 4151 / ECE 22.06 (Shell penetration)",
        hazard: "a pointed object piercing the shell and reaching the head",
        reasonPass: "the striker did not make contact with the headform at any impact point",
        reasonFail: "the striker pierced the shell and touched the headform, resulting in {n} rejection",
        procedure: [[
            "The {n} is fixed on the electrically instrumented headform after the specified conditioning.",
            "The standard pointed striker is dropped in guided free fall from the specified height onto the defined points of the shell.",
            "Electrical contact between the striker and the headform is monitored during every drop.",
            "Any contact, and the damage to the shell, are recorded and judged against the standard."
        ]]
    },

    {
        match: /(visor|face\s*shield).*(optical|transmission|haze|abrasion)|visor\s*test/i,
        standard: "IS 4151 / ECE 22.06 (Visor optical properties)",
        hazard: "distorted or dimmed vision through the visor",
        reasonPass: "the luminous transmittance, optical distortion and haze of the visor were within the limits and no diffusion was seen after abrasion",
        reasonFail: "the transmittance, distortion or haze was outside the limit, resulting in {n} rejection",
        procedure: [[
            "The visor of the {n} is cleaned and mounted in the optical bench at its reference points.",
            "The luminous transmittance is measured with the specified illuminant and compared with the minimum for daytime / night-time use.",
            "Optical distortion, refractive and prismatic power and haze are measured across the field of vision.",
            "The abrasion (haze after rubbing) and, where required, the mist-retardant behaviour are checked against the limits."
        ]]
    },

    {
        match: /helmet.*field\s*of\s*(vision|view)|field\s*of\s*(vision|view).*helmet|peripheral\s*vision.*helmet/i,
        standard: "IS 4151 / ECE 22.06 (Field of vision)",
        hazard: "the shell blocking the rider's peripheral vision",
        reasonPass: "the horizontal and vertical field of vision met or exceeded the minimum angles required",
        reasonFail: "the field of vision was smaller than required, resulting in {n} rejection",
        procedure: [[
            "The {n} is placed on the reference headform and aligned to its basic and reference planes.",
            "The headform is set up in the field-of-vision apparatus with its centre at the specified point.",
            "The horizontal angles to left and right, and the upward and downward angles, that are clear of the shell and visor aperture are measured.",
            "The measured angles are compared with the minimum field of vision in the standard."
        ]]
    },

    // ---- Tyre (IS 15627 / ECE R75) ----
    {
        match: { test: (s) => /(tyre|tire)\s*(dimension|size)|section\s*width|overall\s*diameter|tread\s*depth\s*measurement|tread\s*wear\s*indicator/i.test(s) &&
            !/shaft|rotor|stator|bearing|pulley|gear|cable|\bwires?\b|conductor|harness|bolt|screw|pipe|hose|\bpin\b|washer|\bnut\b|spring|coil|disc|drum|sprocket/i.test(s) },
        standard: "IS 15627 / ECE R75 (Tyre dimensions)",
        hazard: "a tyre that does not match its marked size, so it fouls the vehicle or reads the wrong speed",
        reasonPass: "the section width and overall diameter were within the tolerance for the marked size after the stabilising period",
        reasonFail: "a measured dimension was outside the tolerance for the marked size, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted on its specified measuring rim and inflated to the reference pressure.",
            "It is left to stabilise at room temperature for at least 24 hours, then the pressure is re-set.",
            "The section width is measured at six equally spaced points around the tyre (ignoring raised lettering) and averaged, and the overall diameter is derived from the measured circumference.",
            "Both values, and the tread depth and moulded markings, are compared with the limits for the marked size."
        ]]
    },

    {
        match: { test: (s) => /rigidity|lateral\s*(deformation|compression)|(helmet|shell).*stiffness/i.test(s) &&
            !/frame|chassis|torsion|bend|bracket|mount|swing|\bfork\b|handle|\bstand\b|panel|enclosure|housing|pcb|board|shaft|carrier|rail|body/i.test(s) },
        standard: "IS 4151 / ECE 22.06 (Shell rigidity)",
        hazard: "a shell that deforms so far under a crushing load that it reaches the head",
        reasonPass: "the maximum and residual lateral deformation stayed within the specified limits",
        reasonFail: "the deformation exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The {n} is placed between the two platens of the compression rig in the lateral (side to side) direction.",
            "A pre-load is applied, the reference distance is recorded, and the load is raised at the specified rate to the specified maximum.",
            "The deformation at maximum load is recorded, the load is released in the same way and the residual deformation is measured after the recovery period.",
            "Both deformations are compared with the limits, and the test is repeated in the longitudinal direction where the standard requires it."
        ]]
    },

    {
        match: /bead\s*unseat/i,
        standard: "IS 15627 / ECE R75 (Bead unseating resistance)",
        hazard: "the tyre bead leaving the rim and deflating suddenly under side load",
        reasonPass: "the force needed to unseat the bead met or exceeded the minimum for the tyre size",
        reasonFail: "the bead unseated below the required force, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted on its test rim, inflated to the specified pressure and left to stabilise.",
            "The assembly is placed in the bead-unseating machine and the block is pressed against the sidewall at the specified position.",
            "The force is increased until the bead leaves the rim seat, and the peak force is recorded.",
            "The test is repeated at the specified points around the tyre and the lowest force is compared with the requirement."
        ]]
    },

    {
        match: /(tyre|tire).*(strength|plunger|breaking\s*energy)|plunger\s*(energy|test)|breaking\s*energy/i,
        standard: "IS 15627 / ECE R75 (Tyre strength - plunger energy)",
        hazard: "the casing being punctured by a road obstacle",
        reasonPass: "the breaking energy at every test point met or exceeded the minimum specified for the tyre size",
        reasonFail: "the breaking energy was below the minimum, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted, inflated to the specified pressure and conditioned at room temperature.",
            "A cylindrical plunger of the specified diameter is pressed into the tread at the specified rate.",
            "The force and the displacement are recorded until the tyre or the casing breaks (or the plunger reaches the rim).",
            "The breaking energy is calculated from the force-displacement curve and compared with the minimum."
        ]]
    },

    {
        // Tyres only: a bare "High Speed Test" on a motor is not a tyre drum run.
        match: { test: (s) => /high[\s-]?speed\s*(performance|durability)|(tyre|tire).{0,20}high[\s-]?speed|high[\s-]?speed.{0,20}(tyre|tire)|speed\s*(rating|symbol)\s*verification/i.test(s) &&
            !/motor|bearing|rotor|controller|\bfan\b|pump|gear|spindle|camera|\bcan\b|data|communication/i.test(s) },
        standard: "IS 15627 / ECE R75 (High-speed performance)",
        hazard: "tread separation or burst at the rated speed",
        reasonPass: "the {n} completed the full high-speed programme with no tread, ply, cord, belt or bead separation, chunking or burst",
        reasonFail: "the {n} showed separation, chunking or burst during the high-speed run, resulting in rejection",
        procedure: [[
            "The {n} is mounted on its test rim, inflated to the specified test pressure and conditioned at the test-room temperature for at least three hours.",
            "It is pressed against the test drum at the specified load and run through the step programme of increasing speeds, each for the specified duration.",
            "Pressure, load, speed and temperature are held to the specified tolerances and the tyre is watched throughout.",
            "After the run the tyre is allowed to cool and is examined for separation, cracking, chunking and any change in dimensions."
        ]]
    },

    {
        match: /(tyre|tire).*(endurance|durability|load)\s*test|load[\s\/-]*speed\s*endurance/i,
        standard: "IS 15627 / ECE R75 (Load / endurance)",
        hazard: "failure of the casing under sustained load",
        reasonPass: "the {n} completed the full load-endurance programme without separation, cord breakage or loss of pressure",
        reasonFail: "the {n} failed or lost pressure during the endurance run, resulting in rejection",
        procedure: [[
            "The {n} is mounted, inflated to the specified pressure and conditioned at the test-room temperature.",
            "It is run against the test drum at the specified speed while the load is raised in the specified steps and held for each period.",
            "The pressure is not corrected during the run; load, speed and temperature are recorded throughout.",
            "Afterwards the tyre is cooled, the pressure re-measured and the tyre examined for any separation or damage."
        ]]
    },

    {
        match: /rolling\s*resist/i,
        standard: "ISO 28580 / IS 15627 (Rolling resistance)",
        hazard: "excessive rolling resistance reducing the vehicle's range",
        reasonPass: "the rolling resistance coefficient was within the declared class for the {n}",
        reasonFail: "the rolling resistance coefficient exceeded the declared value, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted on the test rim, inflated to the reference pressure and run in at the specified speed to warm it up.",
            "It is loaded against the drum at the specified reference load and held at the test speed until the readings are stable.",
            "The force (or torque, or power) required to keep it rolling is measured and the parasitic losses of the machine are subtracted.",
            "The result is corrected to the reference temperature and drum diameter and expressed as the rolling resistance coefficient."
        ]]
    },

    // ---- Headlamp / lighting (AIS-010 / ECE R113 / R112 / R6) ----
    {
        // "\blux" so "Magnetic Flux Test" is not read as a lux test; telltales are
        // the indicator check, not headlamp photometry.
        match: { test: (s) => /photometric|beam\s*pattern|light\s*distribution|candela|luminous\s*intensity|\blux\s*(measurement|test)/i.test(s) &&
            !/tell[\s-]*tale|indicator|warning\s*(lamp|light)|display|backlight|screen/i.test(s) },
        standard: "AIS-010 / ECE R113 / ECE R112 (Photometric performance)",
        hazard: "too little light on the road, or glare towards oncoming traffic",
        reasonPass: "the luminous intensity at every specified test point was within the minimum and maximum limits for the class of {n}",
        reasonFail: "the intensity at one or more test points was below the minimum or above the glare maximum, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted on the goniophotometer at the specified distance (typically 25 m, or an equivalent corrected distance) and aimed to its reference axis.",
            "It is supplied at the specified test voltage and aged / stabilised for the period required before the readings are taken.",
            "The illuminance is measured at every test point and zone of the standard's screen pattern, above and below the cut-off.",
            "The readings are converted to candela and compared with the minimum and maximum limits for each point."
        ]]
    },

    {
        match: /cut[\s-]?off\s*(line|gradient)|beam\s*(aim|aiming|alignment)|hv\s*point/i,
        standard: "AIS-010 / ECE R112 (Cut-off line & aiming)",
        hazard: "a badly defined or wrongly aimed cut-off dazzling oncoming drivers",
        reasonPass: "the cut-off line was sharp enough (gradient within limits), horizontal within tolerance and positioned correctly after aiming",
        reasonFail: "the cut-off was diffuse, sloping or wrongly positioned, resulting in {n} rejection",
        procedure: [[
            "The {n} is set up facing the measuring screen at the specified distance and supplied at the test voltage.",
            "The vertical illuminance gradient across the cut-off is scanned and the gradient quality factor is calculated.",
            "The horizontal part of the cut-off is aimed to the specified position and the elbow / kink point is located.",
            "The sharpness, flatness and position of the cut-off are compared with the requirements."
        ]]
    },

    {
        // Deliberately NOT "colour temperature" / "colour rendering": those are
        // display and lighting-quality checks on other products.
        match: /colou?r\s*coordinate|chromaticit|cie\s*(x,?\s*y|coordinate)|colou?r\s*of\s*(the\s*)?(emitted\s*)?light/i,
        standard: "AIS-010 / ECE R48 (Colour of emitted light)",
        hazard: "light of the wrong colour being mistaken for another signal",
        reasonPass: "the chromaticity coordinates fell inside the boundary specified for the required colour",
        reasonFail: "the chromaticity fell outside the specified colour boundary, resulting in {n} rejection",
        procedure: [[
            "The {n} is stabilised at the test voltage for the specified warm-up period.",
            "A spectroradiometer (or colorimeter) is aligned on the reference axis and the spectrum of the emitted light is recorded.",
            "The CIE x, y chromaticity coordinates are calculated from the spectrum.",
            "The coordinates are plotted against the boundaries for white (or the required colour) in the standard."
        ]]
    },

    {
        // NOT a bare "continuous operation test" - that would take over a motor's
        // continuous-duty run and print a lamp burning test for it.
        match: { test: (s) => /(lamp|lens|reflector|light).{0,30}thermal\s*endurance|thermal\s*endurance.{0,30}(lamp|light|burning)|continuous\s*burning|one[\s-]?hour\s*(heat|burn)|(lamp|lens|reflector).*(heat|thermal)\s*(endurance|resistance)/i.test(s) &&
            !/stator|insulat|winding|motor|varnish|\bwires?\b|magnet|cable|enamel|pcb|capacitor|battery|\bcells?\b/i.test(s) },
        standard: "AIS-010 / ECE R112 (Thermal endurance)",
        hazard: "the lens, housing or reflector deforming or discolouring in service heat",
        reasonPass: "after the full burning period the {n} showed no deformation, discolouration, cracking or loss of photometric performance beyond the limit",
        reasonFail: "the {n} deformed, discoloured or lost photometric performance after the heat run, resulting in rejection",
        procedure: [[
            "The photometric performance of the {n} is measured and recorded as the reference.",
            "It is operated continuously at the specified test voltage in its normal mounting position for the required period (for example one hour) at the specified ambient temperature.",
            "The lens, reflector, housing and seals are examined for deformation, discolouration, cracking or condensation.",
            "The photometry is measured again and the change from the reference reading is compared with the allowed limit."
        ]]
    },

    // ---- Horn (AIS-014 / IS 1884 / ECE R28) ----
    {
        // A motor, gearbox, fan or vehicle's sound level is the noise test further down.
        // "Acoustic output" on its own belongs to the general noise test (ISO 3744)
        // - a TV or an appliance is not measured to the vehicle-horn standard.
        match: { test: (s) => /sound\s*(pressure|level|output)|\bspl\b|db\s*\(?a\)?\s*(level|test)|loudness/i.test(s) &&
            !/motor|gear|\bfan\b|pump|compressor|vehicle|pass[\s-]*by|drive|bearing|charger|transformer|converter|controller|cabin|\bnoise\b|speaker/i.test(s) },
        standard: "AIS-014 / IS 1884 / ECE R28 (Sound pressure level)",
        hazard: "a horn too quiet to warn, or loud enough to be a noise nuisance",
        reasonPass: "the A-weighted sound pressure level measured on the axis was within the minimum and maximum specified for the class of {n}",
        reasonFail: "the sound pressure level was below the minimum or above the maximum permitted, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted on the specified rigid fixture in a free field (anechoic or hemi-anechoic room) at the specified height.",
            "A calibrated sound level meter is placed on the axis at the specified distance (typically 2 m) and set to A-weighting.",
            "The horn is supplied at its rated test voltage and sounded for the specified period; the level is recorded, with the background noise checked to be low enough.",
            "The measured dB(A) value is compared with the minimum and maximum limits for that class of horn."
        ]]
    },

    {
        match: /(sound|acoustic|tone)\s*(frequency|spectrum|analysis)|(horn|sound)\s*frequency|frequency\s*(response|spectrum)\s*(of\s*)?(the\s*)?(horn|sound)/i,
        standard: "AIS-014 / IS 1884 (Sound frequency spectrum)",
        hazard: "a tone outside the audible band that is not recognised as a warning",
        reasonPass: "the fundamental frequency and the spectrum stayed within the band specified for the {n}",
        reasonFail: "the fundamental frequency was outside the specified band, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted as for the sound level test and supplied at the rated voltage.",
            "The signal from the microphone on the axis is recorded and a frequency analysis (FFT / third-octave) is carried out.",
            "The fundamental frequency and the main harmonics are identified from the spectrum.",
            "They are compared with the frequency band required by the standard for that type of horn."
        ]]
    },

    {
        // Horn context required: a bare "Current Consumption Test" belongs to
        // whatever product is being tested, not to a horn standard.
        match: /(horn|buzzer|siren)\s*current|current\s*(consumption|draw)\s*(test)?\s*\(?(horn|buzzer)/i,
        standard: "AIS-014 / IS 1884 (Current consumption)",
        hazard: "the horn overloading the wiring, fuse or relay it is connected to",
        reasonPass: "the current drawn at the rated voltage stayed within the specified maximum",
        reasonFail: "the current drawn exceeded the specified maximum, resulting in {n} rejection",
        procedure: [[
            "The {n} is connected through a calibrated shunt or current probe to a supply set at the rated test voltage.",
            "It is operated and the steady current, together with the inrush peak, is recorded on a data logger or oscilloscope.",
            "The supply voltage is varied over the specified range and the current recorded at each step.",
            "The maximum steady and peak currents are compared with the limits for the rating of the {n}."
        ]]
    },

    {
        match: /(horn|buzzer).*(endurance|durability|life|cycl)|continuous\s*(sounding|blowing)/i,
        standard: "AIS-014 / IS 1884 (Operating endurance)",
        hazard: "the horn failing or losing sound output during its service life",
        reasonPass: "after the full number of operating cycles the {n} still worked and its sound level had not fallen below the allowed drop",
        reasonFail: "the {n} stopped working, or its sound level fell beyond the allowed drop, resulting in failure",
        procedure: [[
            "The initial sound pressure level and current of the {n} are measured and recorded.",
            "It is connected to a cycle controller and operated on / off for the specified on and off periods at the rated voltage.",
            "The specified number of cycles is completed (for example the intermittent and continuous duty programmes of the standard) with the horn monitored for failure.",
            "The sound level and current are measured again and the change from the initial readings is compared with the limits."
        ]]
    },

    // ---- Single switch / relay / contactor / fuse / busbar ----
    // First, with names specific enough not to catch any other test: the generic
    // switch, contact-resistance and temperature-rise templates below describe a
    // handlebar switchgear or a MATED connector, which is wrong for these parts.
    {
        match: /switch\s*on[\s\/-]*off\s*operation|on[\s\/-]*off\s*(switch\s*)?(operation|function)/i,
        standard: "IEC 61058-1 / IEC 60947-5-1 (Switch ON/OFF operation)",
        hazard: "a switch that does not make or break its circuit reliably",
        reasonPass: "the switch made and broke its circuit correctly in every position, with continuity and contact resistance within the specified limits",
        reasonFail: "the switch failed to make or break the circuit, stuck or gave intermittent contact, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted in its fitting position on the test fixture (for example on the brake-lever bracket) and wired to a DC supply with its rated resistive load.",
            "The switch is operated through its full travel and the change of state (ON / OFF, or the NO / NC contacts) is checked at the specified operating point.",
            "In each state the continuity and contact resistance of the closed contacts are measured, and the open contacts are checked for no conduction.",
            "The operation is repeated several times to confirm a reliable make and break with no sticking, and the readings are compared with the specification."
        ]]
    },

    {
        match: /coil\s*pick[\s-]*up|pick[\s-]*up\s*(\/|and|&)?\s*drop[\s-]*out|pull[\s-]*in\s*(\/|and|&)?\s*(drop[\s-]*out|release)\s*voltage|operate\s*(\/|and|&)?\s*release\s*voltage|must[\s-]*operate\s*voltage/i,
        standard: "IEC 61810-1 / IEC 60947-4-1 (Coil operate & release voltage)",
        hazard: "a relay or contactor that fails to close at low supply or fails to open when de-energised",
        reasonPass: "the coil operated at or below the specified must-operate voltage and released at or above the specified must-release voltage at every test temperature",
        reasonFail: "the pick-up voltage was too high or the drop-out voltage was outside the limit, resulting in {n} rejection",
        procedure: [[
            "The {n} is stabilised at the test temperature (room temperature, then the maximum operating temperature with the coil hot) and its coil is connected to an adjustable DC supply.",
            "The coil voltage is raised slowly from zero and the voltage at which the contacts close (pick-up / must-operate) is recorded, confirmed by contact continuity.",
            "The coil voltage is then lowered slowly and the voltage at which the contacts open (drop-out / must-release) is recorded.",
            "The coil resistance and current are also measured, and the pick-up and drop-out voltages are compared with the specified limits (for example pick-up at or below 75% and drop-out at or above 10% of the rated coil voltage)."
        ]]
    },

    {
        match: /contact\s*voltage\s*drop/i,
        standard: "IEC 61810-7 / IEC 60947-4-1 (Contact voltage drop)",
        hazard: "high contact resistance causing heating and voltage loss across the closed contacts",
        reasonPass: "the voltage drop across every closed contact stayed within the specified maximum at the test current",
        reasonFail: "the contact voltage drop (resistance) exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The coil of the {n} is energised at its rated voltage so that the main contacts are fully closed.",
            "The specified test current (for example the rated current, or 1 A for low-level contacts) is passed through each closed contact from a stabilised DC source.",
            "The voltage drop across the contact terminals is measured by the four-wire method and the contact resistance is calculated.",
            "The measurement is repeated after several operations, and the voltage drop and resistance are compared with the specified maximum."
        ]]
    },

    {
        match: /making\s*(\/|and|&)?\s*breaking\s*capacity|breaking\s*capacity|interrupting\s*(capacity|rating)/i,
        standard: "IEC 60947-4-1 / IEC 61810-1 / IEC 60269-1 (Making & breaking capacity)",
        hazard: "contact welding, arcing damage or failure to interrupt the rated current",
        reasonPass: "the {n} interrupted (and, for a relay or contactor, also made) the specified test current at the rated voltage without welding, sustained arcing, flashover or rupture",
        reasonFail: "the contacts welded, the arc was not interrupted, or the device ruptured or was damaged while switching the test current, resulting in {n} failure",
        procedure: [[
            "The {n} is connected in a test circuit set to the rated voltage, the specified prospective current and the specified power factor (AC) or time constant (DC).",
            "The specified make / break operations (relay, contactor) or the fault-interruption test (fuse) are carried out, recording current and voltage with an oscilloscope.",
            "The arcing time, any contact welding, flashover to earth, emission of flame or damage to the body are checked during the operations.",
            "Afterwards the {n} is inspected for rupture or damage, and its insulation and voltage drop are re-checked against the limits."
        ]]
    },

    {
        match: /electrical\s*endurance\s*\(\s*operating\s*life\s*\)|electrical\s*life\s*test|relay.{0,15}(electrical|operating)\s*life/i,
        standard: "IEC 61810-1 / IEC 60947-4-1 (Electrical & mechanical endurance)",
        hazard: "contact erosion, welding or coil failure within the rated switching life",
        reasonPass: "after the rated number of switching operations the {n} still operated correctly, with pick-up voltage and contact voltage drop within limits",
        reasonFail: "the contacts welded or eroded, or the device stopped operating before completing the rated switching cycles, resulting in {n} failure",
        procedure: [[
            "The initial pick-up / drop-out voltage and the contact voltage drop of the {n} are measured.",
            "The coil is driven by a cycle controller while the contacts switch the rated load (resistive, inductive or motor load as specified) at the specified on / off rate.",
            "The operations are counted and every contact failure (failure to make or break, or welding) is detected and logged automatically.",
            "After the rated number of operations (for example 100,000 electrical or 1,000,000 mechanical), the operating voltages and contact voltage drop are re-measured and compared with the limits."
        ]]
    },

    {
        match: /time[\s-]*current\s*characteristic|pre[\s-]*arcing|fus(e|ing)\s*(blow(ing)?|opening|melting|operating)\s*time/i,
        standard: "IEC 60269-1 / ISO 8820-1 / SAE J1284 (Time-current characteristic)",
        hazard: "a fuse that blows too early at normal current or too late on overload",
        reasonPass: "the {n} carried the non-fusing current for the specified time and opened within the specified time at every overload current",
        reasonFail: "the fuse opened too early at the non-fusing current or too late at an overload current, resulting in {n} rejection",
        procedure: [[
            "Fuses from the same lot are mounted in the standard test fixture with the specified cable size, in still air at 23 ± 5 °C.",
            "Each fuse is loaded from a constant-current source at the specified multiples of its rating (for example 1.1×, 1.35×, 2×, 3.5× and 6×).",
            "The pre-arcing / opening time is measured at every current, and the non-fusing current is held for the specified time without the fuse opening.",
            "The measured times are plotted against current and compared with the minimum and maximum limits of the time-current band."
        ]]
    },

    {
        match: /fuse\s*voltage\s*drop|fuse.{0,25}cold\s*resistance|cold\s*resistance.{0,25}fuse/i,
        standard: "ISO 8820-1 / IEC 60269-1 (Voltage drop / cold resistance)",
        hazard: "excessive fuse resistance causing heating and voltage loss",
        reasonPass: "the cold resistance and the voltage drop at rated current were within the specified maximum",
        reasonFail: "the fuse resistance or voltage drop exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The cold resistance of each {n} is measured at 23 ± 5 °C with a four-wire micro-ohmmeter at a low current (10% of the rating or less).",
            "The {n} is mounted in the standard test fixture and loaded with its rated current until the temperature stabilises.",
            "The voltage drop across the fuse terminals is measured at thermal equilibrium.",
            "The cold resistance and the voltage drop are compared with the maximum values in the specification."
        ]]
    },

    {
        match: /joint\s*resistance|bolted\s*joint|bus[\s-]*bar\s*(joint|resistance)/i,
        standard: "IEC 61439-1 / IEC 61238-1 (Joint resistance)",
        hazard: "high joint resistance causing local overheating of the busbar connection",
        reasonPass: "the resistance of every bolted or welded joint was within the specified maximum and stayed stable after the thermal cycles",
        reasonFail: "a joint resistance exceeded the specified limit or rose after cycling, resulting in {n} rejection",
        procedure: [[
            "The {n} is assembled on a test fixture with its fasteners tightened to the specified torque (or welded as per the process).",
            "A stabilised DC test current (for example 100 A) is passed through the busbar and each joint.",
            "The voltage drop across each joint and across an equal length of plain busbar is measured by the four-wire method, and the joint resistance is calculated.",
            "The joint resistance is compared with the specified maximum (and with the plain-bar resistance), and re-checked after the thermal cycles."
        ]]
    },

    {
        match: /temperature\s*rise\s*at\s*rated\s*current/i,
        standard: "IEC 60947-1 / IEC 61439-1 / IEC 60269-1 (Temperature rise)",
        hazard: "overheating of the terminals and current path at the rated current",
        reasonPass: "the temperature rise of the terminals and the current path stayed within the specified limit at the rated current",
        reasonFail: "the temperature rise exceeded the specified limit at the rated current, resulting in {n} failure",
        procedure: [[
            "The {n} is mounted in its normal position in still air and connected with cables or bars of the specified cross-section.",
            "The rated current is passed through the current path (with the coil energised at its rated voltage for a relay or contactor).",
            "Thermocouples on the terminals, contacts and body record the temperatures until thermal equilibrium is reached (a change below 1 K per hour).",
            "The temperature rise above ambient at each point is calculated and compared with the specified limit (for example 65 K at the terminals)."
        ]]
    },

    {
        match: /short[\s-]*time\s*withstand|peak\s*withstand\s*current/i,
        standard: "IEC 61439-1 / IEC 60947-1 (Short-time withstand current)",
        hazard: "deformation, melting or contact welding under a short-circuit current",
        reasonPass: "the {n} withstood the specified short-time and peak current with no deformation, melting, welding or insulation damage",
        reasonFail: "the part deformed, melted, welded, or its supports or insulation were damaged by the short-circuit current, resulting in {n} failure",
        procedure: [[
            "The {n} is mounted on its normal supports (or in its enclosure) and connected to a high-current short-circuit test source.",
            "The specified short-time withstand current (for example for 1 s) with the specified peak value is applied, recording the current and its duration.",
            "The {n}, its supports, joints and insulation are inspected for deformation, melting, welding of contacts or cracking.",
            "The joint resistance or contact voltage drop and the dielectric strength are re-checked and compared with the limits."
        ]]
    },

    // ---- Battery electrical abuse tests ----
    // These sit first: "over charge test" would otherwise fall through to the
    // generic template, which says nothing about charging.

    {
        match: /over\s*-?\s*charg/i,
        standard: "IEC 62133-2 / AIS-156 (Overcharge)",
        hazard: "excessive charging voltage and current",
        reasonPass: "the pack withstood the overcharge condition without fire, explosion, venting or leakage, and the protection circuit cut off the charging as intended",
        reasonFail: "the pack vented, overheated or caught fire during the overcharge condition, resulting in {n} failure",
        procedure: [
            [
                "The {n} is charged fully to 100% state of charge by the normal charging method.",
                "Charging is then continued beyond the normal cut-off at the specified charging current, with the voltage limit raised to the overcharge level.",
                "The overcharge condition is maintained for 7 hours, or until the protection circuit cuts off the current.",
                "The voltage, current and temperature are monitored continuously throughout the test."
            ],
            [
                "The {n} is first brought to full charge using the standard charging method.",
                "The charger is then set to the overcharge voltage limit and charging is continued past the normal cut-off point.",
                "This condition is held for 7 hours, or until the pack protection operates.",
                "Voltage, current and cell temperature are recorded throughout."
            ]
        ]
    },

    {
        match: /over\s*-?\s*dis\s*-?\s*charg|deep\s*discharg/i,
        standard: "IEC 62133-2 / AIS-156 (Over-discharge)",
        hazard: "discharging below the safe cut-off voltage",
        reasonPass: "the pack withstood the over-discharge condition without leakage, venting or fire, and the protection circuit cut off the load as intended",
        reasonFail: "the pack leaked, vented or was permanently damaged during the over-discharge condition, resulting in {n} failure",
        procedure: [
            [
                "The {n} is discharged normally until it reaches its lower cut-off voltage.",
                "The specified load resistor is then connected across the terminals and discharging is continued beyond the cut-off.",
                "The over-discharge condition is maintained for 2 hours 30 minutes.",
                "The voltage and temperature are monitored continuously throughout the test."
            ],
            [
                "The {n} is first discharged to its lower cut-off voltage under normal conditions.",
                "Discharging is then forced to continue through the specified load, past the safe cut-off point.",
                "This condition is held for 2 hours 30 minutes, or until the protection circuit disconnects the load.",
                "Voltage and cell temperature are recorded throughout."
            ]
        ]
    },

    {
        // Power-electronics (charger / converter / controller) OUTPUT short-circuit
        // protection - routed before the battery external-short template so a
        // charger's short-circuit-protection test gets the correct power standard.
        match: /short[\s-]*circuit\s*protection|short[\s-]*circuit.{0,14}(response|trip|protect|withstand|recovery)|protect\w*.{0,14}short[\s-]*circuit|output\s*short[\s-]*circuit|fault\s*current.{0,14}(trip|protect)/i,
        standard: "IEC 62477-1 / IEC 61204-3 (Output short-circuit protection)",
        hazard: "a short circuit across the output / load side",
        reasonPass: "the {n} detected the output short circuit, its protection limited the current or shut down safely, and it recovered without damage",
        reasonFail: "the {n} failed to limit the short-circuit current or was damaged, resulting in {n} failure",
        procedure: [[
            "The {n} is run at rated output into an electronic load.",
            "A short circuit (a low-resistance link) is applied across the output terminals.",
            "The protection reaction (current limit, foldback, hiccup mode or shutdown) and the recovery when the short is removed are recorded.",
            "The peak fault current, the response time and the post-test function are compared with the specification - the {n} must limit the current and shut down safely without damage."
        ]]
    },

    {
        match: /short\s*-?\s*circuit/i,
        standard: "IEC 62133-2 / AIS-156 (External short circuit)",
        hazard: "an external short circuit across the terminals",
        reasonPass: "the pack withstood the short circuit without fire or explosion, and the protection device opened the circuit as intended",
        reasonFail: "the pack overheated, vented or caught fire during the short circuit, resulting in {n} failure",
        procedure: [
            [
                "The {n} is charged fully by the normal charging method.",
                "The positive and negative terminals are then shorted through a link of not more than 100 milliohms.",
                "The short circuit is maintained for 1 hour, or until the protection device operates.",
                "The current and the pack temperature are monitored continuously throughout the test."
            ],
            [
                "The fully charged {n} is placed behind a safety shield.",
                "A short circuit link of resistance below 100 milliohms is connected directly across the terminals.",
                "The short is held for 1 hour, or until the protection device opens the circuit.",
                "Current and temperature are recorded throughout."
            ]
        ]
    },

    {
        match: /cycle\s*life|charge\s*dis\s*-?\s*charge/i,
        standard: "IEC 62133-2 / IS 16893 (Cycle life)",
        hazard: "repeated charge and discharge cycling",
        reasonPass: "the pack completed the required number of cycles and retained capacity above the acceptance limit",
        reasonFail: "the pack capacity fell below the acceptance limit before the required number of cycles, resulting in {n} failure",
        procedure: [
            [
                "The starting capacity of the {n} is measured by one full charge and discharge at the specified rate.",
                "The {n} is then charged and discharged repeatedly at the specified rates, with a rest period between each cycle.",
                "The cycling is continued for the required number of cycles.",
                "The capacity is measured again at the end and compared with the starting capacity."
            ],
            [
                "The {n} is placed in the chamber at the specified temperature and its initial capacity is recorded.",
                "It is then cycled between full charge and full discharge at the specified current rates.",
                "The test runs for the required number of cycles, with a rest between each cycle.",
                "The final capacity is measured and the capacity retention is calculated."
            ]
        ]
    },

    {
        // NOT "penetration resistance" - that is the PPE/material test further
        // down this list. The bare "penetrat" alternative was first-match-wins,
        // so a helmet's Penetration Resistance Test printed the battery
        // nail-penetration method under a battery standard.
        match: /nail\s*penetrat|penetrat(?!ion\s*resist)/i,
        standard: "GB 38031 / AIS-156 / ISO 6469-1 (Nail penetration)",
        hazard: "an internal short circuit created by penetration",
        reasonPass: "penetration did not cause fire or explosion within the required time (or the pack met the acceptance criteria for the standard)",
        reasonFail: "the pack caught fire or exploded on penetration, resulting in {n} failure",
        procedure: [[
            "The {n} is charged fully to 100% state of charge and instrumented with thermocouples on the cells near the penetration point.",
            "A steel nail of the specified diameter is driven through the cell/pack at the specified speed and depth to create an internal short circuit.",
            "The nail is left in place while the voltage, temperature, smoke, fire and any explosion are observed for the required period (for example 1 hour).",
            "The result is judged against the standard - typically no fire or explosion, or the required warning time before any hazard."
        ]]
    },

    {
        match: /crush|crash\s*test|mechanical\s*abuse|squeez/i,
        standard: "IEC 62133-2 / UN 38.3 (T.6) / AIS-156 (Crush)",
        hazard: "mechanical deformation of the cells",
        reasonPass: "the pack withstood the crush force without fire or explosion, and the protection operated as intended",
        reasonFail: "the pack caught fire, exploded or vented during the crush, resulting in {n} failure",
        procedure: [[
            "The fully charged {n} is placed between the crush plates of the test press behind a safety shield.",
            "A crushing force is applied (for example 13 kN, or until a specified deformation such as 15% or a sudden voltage drop) along the specified axis.",
            "The force is held for the specified time while the voltage, temperature, smoke and fire are monitored.",
            "The pack is observed for the required period afterwards and judged against the no-fire / no-explosion criterion."
        ]]
    },

    {
        match: /forced\s*discharg|reverse\s*charg/i,
        standard: "IEC 62133-2 / UN 38.3 (T.8) (Forced discharge)",
        hazard: "forced (reverse) discharge of a cell",
        reasonPass: "the cell withstood the forced discharge without fire, explosion or rupture",
        reasonFail: "the cell vented, ruptured or caught fire during the forced discharge, resulting in {n} failure",
        procedure: [[
            "A fully discharged {n} (or cell) is connected in series with a DC power supply behind a safety shield.",
            "It is force-discharged by driving the specified reverse current through it (for example the rated current) into reverse polarity.",
            "The forced discharge is continued for the specified time or reverse capacity while voltage and temperature are monitored.",
            "The cell is observed for fire, venting or rupture and judged against the acceptance criterion."
        ]]
    },

    {
        match: /altitude|low\s*pressure|high\s*altitude/i,
        standard: "UN 38.3 (T.1, Altitude simulation)",
        hazard: "low pressure at high altitude / air transport",
        reasonPass: "the pack showed no leakage, venting, disassembly or rupture and held its voltage after the low-pressure exposure",
        reasonFail: "the pack leaked, vented or lost voltage during the low-pressure exposure, resulting in {n} failure",
        procedure: [[
            "The {n} is placed in an altitude (vacuum) chamber at ambient temperature.",
            "The pressure is reduced to 11.6 kPa (equivalent to about 15 200 m altitude) and held for at least 6 hours.",
            "The open-circuit voltage, mass and appearance are recorded before and after the exposure.",
            "The pack must show no leakage, venting, disassembly, rupture or fire, and no more than the allowed voltage loss."
        ]]
    },

    // ---- Control electronics: BMS / VCU / controller / dashboard / communication ----
    // Specific electronic-unit tests sit early so they are not read as motor/power tests.

    {
        // A lamp or horn works straight off the vehicle supply: its supply-range test
        // is "does it still light / sound correctly from minimum to maximum
        // voltage" - not the power-supply output-regulation test (IEC 61204-3).
        match: /(lamp|light|horn|buzzer)\s*supply\s*voltage|supply\s*voltage.{0,20}(lamp|light|horn|buzzer)/i,
        standard: "ISO 16750-2 / AIS-010 / AIS-014 (Supply voltage range)",
        hazard: "the lamp or horn working poorly or failing at low or high vehicle voltage",
        reasonPass: "the {n} worked correctly with light output / sound level within limits at the minimum, nominal and maximum supply voltage",
        reasonFail: "the {n} did not work correctly, or its light output / sound level was out of limits, at a supply voltage inside the specified range",
        procedure: [[
            "The {n} is connected to a programmable DC supply with its current and output monitored.",
            "It is operated at the minimum, nominal and maximum supply voltage of the specified range (for example 9 V, 12 V and 16 V for a 12 V system).",
            "At each voltage the light output or sound level and the current are measured after they stabilise.",
            "The operation, light output or sound level and current at each voltage are compared with the specification."
        ]]
    },

    {
        // Power electronics (charger / controller / DC-DC / inverter): the unit
        // derates, then shuts down when too hot. Not the BMS cell-simulator test.
        match: /over[\s-]*temp\w*\s*(derating|shut[\s-]*down)|thermal\s*(derating|shut[\s-]*down)/i,
        standard: "IEC 62477-1 / product specification (Over-temperature derating and shutdown)",
        hazard: "the unit overheating without reducing power or shutting down",
        reasonPass: "the {n} started derating and shut down at the specified temperatures and restarted correctly after cooling",
        reasonFail: "the {n} did not derate or shut down at the specified temperature, or did not recover, resulting in failure",
        procedure: [[
            "Thermocouples are fixed to the power stage heat sink and the internal temperature sensor reading is logged.",
            "The {n} runs at full load while the ambient temperature is raised in a thermal chamber (or cooling is restricted).",
            "The temperatures at which power starts to derate and at which the unit shuts down are recorded.",
            "The chamber is cooled and the restart temperature is recorded; all three are checked against the specification."
        ]]
    },

    {
        // BMS/ECU protection functions - sits before the surge/overcharge templates.
        // Excludes names that have their own dedicated template (reverse polarity /
        // reverse power / load dump / jump start) so it doesn't grab them.
        match: { test: (s) =>
            (/protection\s*(test|function|threshold|trip)|over[\s-]*voltage\s*protect|under[\s-]*voltage\s*protect|over[\s-]*current\s*protect|over[\s-]*temp\w*\s*protect|under[\s-]*temp\w*\s*protect|cut[\s-]*off\s*(voltage|test)|threshold\s*verif/i.test(s))
            && !/reverse\s*polarit|reverse\s*power|reverse\s*current|back[\s-]?feed|load\s*dump|jump\s*start|ingress|\bip\b|thermal\s*overload|motor|winding|stator/i.test(s) },
        standard: "ISO 6469-1 / IEC 62619 (Protection functions)",
        hazard: "a protection function not tripping at its threshold",
        reasonPass: "each protection function tripped at the correct threshold and within the required time, and recovered correctly",
        reasonFail: "a protection function failed to trip at its threshold, resulting in {n} failure",
        procedure: [[
            "The {n} is connected to a cell/pack simulator (or signal injector) on the bench so each monitored quantity can be forced.",
            "For each protection (over-voltage, under-voltage, over-current, over-/under-temperature) the input is ramped past the specified threshold.",
            "The trip point, the reaction (warning, current limit, contactor opening or shutdown) and the reaction time are recorded.",
            "The trip threshold, hysteresis and timing are compared with the specification, and correct recovery/reset is verified."
        ]]
    },

    {
        // This block sits BEFORE the throttle block, so it must not swallow
        // "position/angle sensor accuracy" - that is a travel-fixture test on a
        // throttle, not a calibrated-reference test on a measuring instrument.
        match: {
            test: (s) => !/\b(position|angle|pedal|throttle|travel|rotary)\b/i.test(String(s)) &&
                !/inrush|in-rush|consumption|leakage|quiescent|no[\s-]*load|standby/i.test(String(s)) &&
                /measurement\s*accuracy|sensing\s*accuracy|voltage\s*measurement|current\s*measurement|temperature\s*measurement|adc\s*accuracy|sensor\s*accuracy|reading\s*accuracy/i.test(String(s))
        },
        standard: "IEC 61010 / ISO 6469-1 / product specification (Measurement accuracy)",
        hazard: "measurement error outside the specified accuracy",
        reasonPass: "every measured channel stayed within the specified accuracy against the reference",
        reasonFail: "a measured channel exceeded the specified accuracy, resulting in {n} rejection",
        procedure: [[
            "The {n} is connected to a calibrated reference source/meter for the quantity being measured (voltage, current or temperature).",
            "A range of reference values is applied across the full measurement span, including the end points.",
            "At each point the value reported by the {n} is compared with the calibrated reference and the error is recorded.",
            "The maximum error across the range is compared with the specified accuracy (for example ±0.5% or ±2 °C)."
        ]]
    },

    {
        match: /\bcan\b|communication|\blin\b|bus\s*test|protocol\s*test|\buds\b|\bcanbus\b|data\s*link/i,
        standard: "ISO 11898 (CAN) / ISO 16845 (CAN conformance) / ISO 14229 (UDS)",
        hazard: "loss or corruption of communication messages",
        reasonPass: "all messages were transmitted and received correctly within timing, with correct error handling",
        reasonFail: "messages were lost, corrupted or mistimed, resulting in {n} failure",
        procedure: [[
            "The {n} is connected to a bus analyser (for example a CAN/LIN tool) and the network is set to the specified baud rate and termination.",
            "The transmitted messages, identifiers, cycle times and signal values are logged and checked against the communication matrix (DBC).",
            "Commands and diagnostic requests (UDS) are sent and the {n} responses and timing are verified.",
            "Bus-error conditions (missing termination, bit errors, bus-off) are injected and the recovery behaviour is verified."
        ]]
    },

    {
        match: /diagnostic|fault\s*handling|fault\s*injection|\bdtc\b|error\s*handling|fail[\s-]*safe|limp\s*(home|mode)|watchdog/i,
        standard: "ISO 26262 / ISO 14229 (Diagnostics & fault handling)",
        hazard: "incorrect or missing response to a fault",
        reasonPass: "each injected fault was detected, the correct DTC was set and the safe (fail-safe) reaction occurred within the time limit",
        reasonFail: "a fault was not detected or the safe reaction did not occur, resulting in {n} failure",
        procedure: [[
            "The {n} is run in its normal operating mode on the bench or HIL setup.",
            "Each defined fault is injected in turn (sensor open/short, over-range signal, communication loss, supply dip).",
            "The fault detection, the diagnostic trouble code (DTC) set and the fail-safe reaction (limp-home, shutdown, warning) are recorded.",
            "The detection, the DTC and the reaction time are compared with the safety requirement."
        ]]
    },

    {
        match: /soc\s*estimat|soh\s*estimat|state\s*estimat|state[\s-]*of[\s-]*charge.{0,20}(estimat|accuracy)|state[\s-]*of[\s-]*health.{0,20}(estimat|accuracy)|\bsoc\b.{0,15}accuracy|\bsoh\b/i,
        standard: "ISO 6469-1 / product specification (State estimation accuracy)",
        hazard: "state-of-charge / state-of-health estimation error",
        reasonPass: "the estimated SoC/SoH stayed within the specified error against the reference over the test profile",
        reasonFail: "the SoC/SoH estimate exceeded the specified error, resulting in {n} rejection",
        procedure: [[
            "A reference battery (or emulator) with a known true SoC/SoH is connected to the {n}.",
            "A representative drive/charge profile is run while the estimated and the reference SoC/SoH are logged.",
            "The estimation error is calculated across the profile, including near empty and full.",
            "The maximum error is compared with the specified accuracy (for example SoC within ±3%)."
        ]]
    },

    {
        // PASSIVE balancing (bleed / shunt resistors) - sits before the generic one.
        match: /passive\s*(cell\s*)?balanc|resistive\s*balanc|dissipative\s*balanc|bleed\s*(balanc|resist|current)|shunt\s*balanc/i,
        standard: "ISO 6469-1 / IEC 62619 (Passive cell balancing)",
        hazard: "excess charge on the higher cells not bled off correctly",
        reasonPass: "the passive balancing bled the higher cells and brought the cell-voltage spread within the specified limit",
        reasonFail: "the passive balancing failed to bleed the cells within the specified spread or overheated, resulting in {n} failure",
        procedure: [[
            "The pack (or cell simulator) is set with a defined over-voltage on one or more of the higher cells.",
            "The BMS passive balancing is enabled and the bleed (shunt) resistor current and every cell voltage are logged over time.",
            "It is confirmed that ONLY the higher cells are bled - current flows through their bleed resistors and the excess charge is dissipated as heat - and the bleed-resistor temperature is checked.",
            "The time to bring the cell-voltage spread within the target and the bleed current are compared with the specification."
        ]]
    },

    {
        // ACTIVE balancing (charge shuttled high cell -> low cell).
        match: /active\s*(cell\s*)?balanc|charge\s*(shuttl|transfer|redistrib)|inductive\s*balanc|capacitive\s*balanc|c2c\s*balanc|redistribut\w*\s*balanc/i,
        standard: "ISO 6469-1 / IEC 62619 (Active cell balancing)",
        hazard: "charge not transferred efficiently from high to low cells",
        reasonPass: "the active balancing moved charge from the high cells to the low cells and brought the spread within limit at the specified efficiency",
        reasonFail: "the active balancing failed to equalise the cells or its transfer efficiency was below limit, resulting in {n} failure",
        procedure: [[
            "The pack (or cell simulator) is set with a defined imbalance (some high cells, some low cells).",
            "The BMS active balancing is enabled and the charge moved FROM the higher cells TO the lower cells (via the capacitive / inductive / DC-DC converter) is measured while the cell voltages and transfer currents are logged.",
            "The balancing efficiency (charge delivered to the low cells versus charge drawn from the high cells) and the transfer current are recorded, along with the temperature.",
            "The time to bring the spread within target, the efficiency and the temperature are compared with the specification."
        ]]
    },

    {
        // Generic cell balancing - covers whichever method the BMS uses.
        match: /cell\s*balanc|pack\s*balanc|battery\s*balanc|charge\s*balanc|balanc\w*\s*(function|current|accuracy)/i,
        standard: "ISO 6469-1 / IEC 62619 (Cell balancing)",
        hazard: "cell imbalance not corrected by the balancing function",
        reasonPass: "the balancing function reduced the cell-voltage spread to within the specified limit",
        reasonFail: "the balancing function failed to bring the cells within the specified spread, resulting in {n} failure",
        procedure: [[
            "The pack (or cell simulator) is set with a defined cell-voltage imbalance across the cells.",
            "The BMS balancing function is enabled - passive (bleed resistors dissipating charge as heat) or active (charge shuttled from high cells to low cells), as fitted - and the cell voltages and balancing currents are logged over time.",
            "The time to bring the cell-voltage spread within the target, the balancing current and (for passive) the bleed-resistor temperature or (for active) the transfer efficiency are recorded.",
            "The final cell-voltage spread and the balancing behaviour are compared with the specification."
        ]]
    },

    {
        match: /contactor|relay\s*control|pre[\s-]*charg|precharge|main\s*switch\s*control/i,
        standard: "ISO 6469-1 / IEC 60947 (Contactor / pre-charge control)",
        hazard: "incorrect contactor sequencing or pre-charge failure",
        reasonPass: "the contactors closed and opened in the correct sequence and the pre-charge limited the inrush within the limit",
        reasonFail: "the contactor sequence or pre-charge failed, resulting in {n} failure",
        procedure: [[
            "The {n} is connected to the contactors and a representative DC-link capacitance with current and voltage probes.",
            "A power-up is commanded and the pre-charge current, the DC-link voltage rise and the closing sequence of the main contactors are recorded.",
            "A normal shut-down and an emergency (fault) shut-down are commanded and the opening sequence and timing are recorded.",
            "The sequence, pre-charge inrush and timing are compared with the specification."
        ]]
    },

    {
        match: /insulation\s*monitor|\bimd\b|isolation\s*monitor|isolation\s*resistance\s*monitor/i,
        standard: "ISO 6469-3 / IEC 61557-8 (Insulation monitoring)",
        hazard: "failure to detect a drop in isolation resistance",
        reasonPass: "the monitor detected the reduced isolation resistance and raised the warning at the specified threshold",
        reasonFail: "the monitor failed to detect the isolation fault, resulting in {n} failure",
        procedure: [[
            "The {n} insulation-monitoring function (IMD) is connected to the HV system with the chassis reference.",
            "A calibrated resistance is applied between the HV lines and chassis and reduced in steps toward the fault threshold.",
            "The isolation resistance reported by the {n} and the point at which it raises the warning are recorded.",
            "The measured detection threshold and response time are compared with the requirement (for example 100 Ω/V)."
        ]]
    },

    {
        match: /display\s*test|screen\s*test|\blcd\b|\btft\b|backlight|readability|luminance|brightness|pixel|sunlight\s*read/i,
        standard: "ISO 15008 / product specification (Display / readability)",
        hazard: "poor display legibility or defects",
        reasonPass: "the display met the specified brightness, contrast and legibility with no pixel or backlight defects",
        reasonFail: "the display failed a brightness, contrast or pixel requirement, resulting in {n} rejection",
        procedure: [[
            "The {n} display is driven with the standard test patterns in a controlled-light environment.",
            "The luminance (brightness), contrast ratio and colour are measured with a calibrated photometer at the specified points.",
            "Legibility is checked at the specified viewing angles and under simulated sunlight, and the screen is inspected for dead or stuck pixels.",
            "The measured values are compared with the specified brightness, contrast, viewing-angle and defect limits."
        ]]
    },

    {
        match: /touch\s*test|touch\s*screen|button\s*test|keypad|\bhmi\b|input\s*test|switch\s*actuation|tactile/i,
        standard: "Product specification (HMI / input)",
        hazard: "unreliable touch or button input",
        reasonPass: "every input registered correctly with the specified force/accuracy and no false triggers",
        reasonFail: "an input failed to register or gave false triggers, resulting in {n} rejection",
        procedure: [[
            "The {n} is powered in its normal mode with the input-logging tool connected.",
            "Each touch zone or button is actuated in turn (including edges and multi-touch where applicable) at the specified force.",
            "The registered input, the actuation force and the response time are recorded, and repeated actuations check for false or missed triggers.",
            "The accuracy, force and response are compared with the specification, and endurance actuations are run where required."
        ]]
    },

    {
        // Not a tyre's tread wear indicator (that is the tyre marking check).
        match: { test: (s) => /indicator|telltale|tell[\s-]*tale|warning\s*lamp|warning\s*light|icon\s*test/i.test(s) && !/tread|tyre|tire|wear\s*indicator|dial\s*indicator/i.test(s) },
        standard: "ISO 2575 (Symbols) / product specification (Indicators)",
        hazard: "wrong, missing or unclear indicator behaviour",
        reasonPass: "every indicator and telltale lit with the correct symbol, colour and trigger condition",
        reasonFail: "an indicator was wrong, missing or mis-triggered, resulting in {n} failure",
        procedure: [[
            "The {n} is powered and a lamp/bulb-check is commanded so all indicators illuminate.",
            "Each trigger condition is applied in turn (for example fault, low battery, turn signal) and the corresponding indicator is verified.",
            "The symbol (per ISO 2575), colour, brightness and blink behaviour of each indicator are checked.",
            "The behaviour of every indicator is compared with the specification."
        ]]
    },

    {
        match: /regen\w*\s*brak|torque\s*command|torque\s*request|drive\s*mode|pedal\s*map|throttle\s*map|acceleration\s*command/i,
        standard: "Product specification / ISO 26262 (Torque / drive control)",
        hazard: "incorrect torque or braking response to the driver command",
        reasonPass: "the delivered torque and regen braking followed the commanded map within the specified tolerance",
        reasonFail: "the torque or regen response deviated from the command, resulting in {n} rejection",
        procedure: [[
            "The {n} is run on a HIL rig or with the drivetrain, with the accelerator/brake inputs and the commanded torque logged.",
            "The pedal is swept across its range in each drive mode, and regenerative braking is applied at several deceleration levels.",
            "The commanded torque, the delivered torque and the regen current/torque are recorded against the pedal map.",
            "The response is compared with the specified torque/regen map and tolerance, including the zero-crossing behaviour."
        ]]
    },

    {
        match: /sleep\s*current|quiescent\s*current|dark\s*current|sleep\s*mode|wake[\s-]*up|key[\s-]*off\s*current|parasitic\s*(current|draw)/i,
        standard: "Product specification (Sleep / quiescent current)",
        hazard: "excessive key-off current draining the 12 V battery",
        reasonPass: "the sleep (quiescent) current was within the specified limit and the unit woke correctly on the wake signal",
        reasonFail: "the sleep current exceeded the limit or the unit failed to wake, resulting in {n} rejection",
        procedure: [[
            "The {n} is powered at nominal supply and commanded (or allowed) to enter its sleep / key-off state.",
            "After the specified settling time the steady-state supply current is measured with a low-range current meter.",
            "A wake-up event (CAN wake, terminal, switch) is applied and the wake-up time and return to normal operation are verified.",
            "The measured sleep current and wake-up time are compared with the specification."
        ]]
    },

    // ---- Throttle / accelerator / position-sensor tests ----
    // A throttle is a position sensor (Hall / potentiometer), NOT a motor. These
    // sit before the motor block so its tests aren't read as motor tests.

    // Also catches "position sensor accuracy", which otherwise fell through to the
    // instrument-calibration template (IEC 61010) - that is for meters, not a throttle.
    {
        match: /linearit|non[\s-]*linearit|transfer\s*(function|curve)|output.{0,20}(vs|versus|against).{0,10}(position|angle|travel)|(position|angle|travel).{0,15}output|(position|angle|pedal|throttle)\s*sensor\s*accuracy|(position|angle)\s*accuracy/i,
        standard: "ISO 16750 / product specification (Output linearity / position accuracy)",
        hazard: "output signal deviating from the ideal position curve",
        reasonPass: "the output-versus-position curve stayed within the specified linearity error over the full travel",
        reasonFail: "the output deviated from the specified linearity, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted on a calibrated angular (or linear) travel fixture with its supply at nominal voltage.",
            "The {n} is moved from one end of its travel to the other in small, known steps and the output signal is recorded at each step.",
            "The output is plotted against position and the deviation from the ideal best-fit straight line is calculated as a percentage of full scale.",
            "The maximum linearity error is compared with the specified limit (for example within ±2% of full scale)."
        ]]
    },

    {
        match: /output\s*(signal\s*)?range|signal\s*range|output\s*span|clamp\s*(voltage|output|level)|output\s*(limits|high|low)|idle\s*(and\s*)?(full|wide[\s-]?open)\s*output|min[\s-]?max\s*output/i,
        standard: "ISO 16750 / product specification (Output signal range)",
        hazard: "output signal outside the specified idle / full range or clamp levels",
        reasonPass: "the idle, full-travel and clamp output levels were within the specified signal range",
        reasonFail: "an output level was outside the specified range, resulting in {n} rejection",
        procedure: [[
            "The {n} is powered at nominal supply and connected to a calibrated voltmeter / DAQ on the signal output.",
            "The output is recorded at the idle stop and at the full-travel stop to get the low and high output levels.",
            "The upper and lower clamp (limp-home / fault) levels are checked by driving the output to its electrical limits where applicable.",
            "The idle, full and clamp output levels are compared with the specified signal range (for example 0.5 V idle to 4.5 V full)."
        ]]
    },

    {
        match: /hysteresis/i,
        standard: "Product specification (Hysteresis)",
        hazard: "different output for the same position depending on direction",
        reasonPass: "the up-sweep and down-sweep outputs agreed within the specified hysteresis limit",
        reasonFail: "the hysteresis exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The {n} supply is set to nominal and the output is logged while it is swept slowly from one end of its travel to the other.",
            "It is then swept slowly back through the same travel while the output is logged again.",
            "At each reference position the difference between the increasing-direction and decreasing-direction output is measured.",
            "The maximum hysteresis (as a percentage of full scale) is compared with the specified limit."
        ]]
    },

    {
        match: /dead[\s-]*band|dead[\s-]*zone|dead[\s-]*travel|idle\s*band/i,
        standard: "Product specification (Deadband / idle band)",
        hazard: "excessive idle travel before the output responds",
        reasonPass: "the idle deadband and the top deadband were within the specified travel limits",
        reasonFail: "the deadband was outside the specified limits, resulting in {n} rejection",
        procedure: [[
            "The {n} is held at the idle stop and its idle output level is recorded.",
            "The throttle is opened very slowly and the travel at which the output first starts to change is measured (idle deadband).",
            "The same is done approaching the full stop to measure the top deadband where the output stops changing.",
            "The idle and top deadband travel are compared with the specification."
        ]]
    },

    // Return-to-idle is a SPRING/safety test, not a repeatability test - it must come
    // before the repeatability entry so it stops inheriting that procedure.
    {
        match: /return[\s-]*to[\s-]*(idle|zero|rest)|idle\s*return|auto[\s-]*return|spring\s*return|self[\s-]*return/i,
        standard: "ISO 26262 / product specification (Return-to-idle / spring return)",
        hazard: "the throttle not springing fully back to idle when released - unintended acceleration",
        reasonPass: "the throttle returned to the idle output within the specified time and band from every position, on every release",
        reasonFail: "the throttle failed to return fully to idle or was too slow, resulting in {n} rejection on a safety-critical function",
        procedure: [[
            "The {n} is mounted in its normal orientation with the supply at nominal voltage and the output monitored on a storage oscilloscope.",
            "The throttle is opened to a set position (25%, 50%, 75% and 100% of travel), held briefly, then released cleanly from the fully open stop.",
            "The return time and the settled idle output are captured on each release, and the return spring force is checked for smooth action with no sticking.",
            "The test is repeated for the specified number of releases, including after the endurance and temperature/humidity exposures where required.",
            "The settled idle output and the return time are compared with the specified idle band and maximum return time."
        ]]
    },

    {
        match: /repeatab|reproducib/i,
        standard: "Product specification (Output repeatability)",
        hazard: "inconsistent output for the same position",
        reasonPass: "the output repeated within the specified band at every reference position",
        reasonFail: "the output did not repeat within the specified band, resulting in {n} failure",
        procedure: [[
            "The {n} is cycled to several fixed reference positions and released, repeated many times at nominal supply.",
            "The output at each reference position is recorded over the repeats and the spread (max - min) is calculated.",
            "The measurement is taken approaching each position from both directions to separate repeatability from hysteresis.",
            "The output spread at each reference position is compared with the specified repeatability band."
        ]]
    },

    // A throttle/position sensor is supplied from the ECU's 5 V rail and its output is
    // RATIOMETRIC. Without this it matched the power-supply template (IEC 61204-3,
    // "loaded at rated output... regulation"), which is a converter test, not a sensor
    // test. Placed in the sensor block so it wins for throttles/pedals/sensors only.
    {
        // Throttle / pedal / position sensors only: a charger, lamp, horn or other
        // unit's supply range is the plain input-range test further down.
        // Only when the name says sensor/throttle (or is the sensor list's own bare
        // "Supply Voltage Range Test"): the power list's generic "Input Voltage
        // Range Verification" for chargers / controllers / DC-DC / VCU landed here.
        match: { test: (s) => /ratiometric/i.test(s) ||
            /^\s*supply\s*voltage\s*range(\s*test)?\s*$/i.test(s) ||
            (/(throttle|pedal|accelerator|sensor|hall|potentiometer|position|grip)/i.test(s) &&
             /(supply|operating|input)\s*voltage\s*(range|variation|window)|voltage\s*range\s*test/i.test(s)) },
        standard: "ISO 16750-2 / product specification (Supply voltage range - ratiometric output)",
        hazard: "the position output drifting outside its band as the 5 V supply varies",
        reasonPass: "the output tracked the supply ratiometrically and stayed within the specified band across the whole supply range",
        reasonFail: "the output moved outside the specified band as the supply varied, resulting in {n} rejection",
        procedure: [[
            "The {n} is connected to a programmable supply on its sensor supply pin (typically 5 V nominal) with the signal output monitored.",
            "The {n} is held at fixed reference positions (idle, 25%, 50%, 75%, full) using a calibrated travel fixture.",
            "At each position the supply is varied in steps across the specified range (for example 4.5 V to 5.5 V) and the output is recorded at each step.",
            "The output is expressed as a ratio of the supply (output / supply) to confirm the sensor is ratiometric and the ratio holds across the range.",
            "The behaviour below and above the range is checked: the output must stay valid or flag a fault, never give a false higher-position reading.",
            "The output band at each position and the ratiometric error are compared with the specification."
        ]]
    },

    {
        match: /track\s*resistance|wiper\s*resistance|resistance\s*span|span\s*calibrat|(potentiometer|wiper|track).{0,15}contact\s*resistance/i,
        standard: "Product specification (Contact / track resistance)",
        hazard: "high or unstable wiper/track resistance (potentiometer type)",
        reasonPass: "the track and contact resistance were within the specified span and stable across the travel",
        reasonFail: "the contact resistance was out of span or unstable, resulting in {n} rejection",
        procedure: [[
            "The {n} (potentiometer type) is connected to a calibrated ohmmeter across the track and wiper terminals.",
            "The total track resistance is measured, then the wiper resistance is read as the throttle is moved across the full travel.",
            "The resistance is checked for smooth change with no open circuit, dropout or noise (contact bounce) at any position.",
            "The end-to-end span and the contact resistance are compared with the specified values."
        ]]
    },

    {
        match: /electrical\s*continuity|signal\s*continuity|circuit\s*continuity|wiring\s*continuity|pin\s*continuity/i,
        standard: "Product specification (Electrical continuity)",
        hazard: "an open or intermittent connection in the harness/pins",
        reasonPass: "every signal, supply and ground path showed continuity within the specified resistance",
        reasonFail: "a path was open or intermittent, resulting in {n} rejection",
        procedure: [[
            "The {n} connector pins are identified from the pin-out and a calibrated milliohm meter is connected to each path in turn.",
            "The continuity and resistance of each signal, supply and ground path are measured from the pin to the internal circuit.",
            "The connector is gently flexed and wiggled during measurement to reveal any intermittent (open) connection.",
            "Each path resistance is compared with the specified maximum and checked for a stable, non-intermittent reading."
        ]]
    },

    // Pedal / throttle cycling and the "electrical endurance" of a sensor are the SAME
    // wear test, and it is mechanical-actuation wear - not the motor run-hours test
    // (IEC 60034-1) these names were falling through to.
    {
        // Switches, relays, horns etc. have their own endurance templates below.
        match: { test: (s) => /actuation\s*(cycle|endurance)|operating\s*cycle|travel\s*endurance|rotation.{0,6}(cycle|endurance)|throttle.{0,20}endurance|grip.{0,20}endurance|life\s*cycle.{0,15}(throttle|grip|lever|sensor|pedal)|pedal.{0,20}(cycle|durability|endurance)|(cycle|durability).{0,15}pedal|electrical\s*endurance|mechanical\s*endurance|sensor.{0,15}endurance/i.test(s) &&
            !/switch|relay|contactor|\bcontacts?\b|horn|fuse|breaker|connector|latch|lock|hinge|stand|door|lid/i.test(s) },
        standard: "ISO 16750 / product specification (Actuation endurance)",
        hazard: "wear or output drift after many actuations",
        reasonPass: "after the full number of actuation cycles the output stayed within limits and the throttle still returned to idle",
        reasonFail: "the output drifted out of limits or the return spring weakened after cycling, resulting in {n} failure",
        procedure: [[
            "The {n} is fitted to an automatic actuator that opens and releases the throttle over its full travel.",
            "The specified number of actuation cycles is run (for example 100,000 cycles) at the specified rate.",
            "At set intervals the output linearity, idle/full output and return-to-idle are re-checked.",
            "After the full count the output, hysteresis and mechanical feel are compared with the initial readings and the limits."
        ]]
    },

    // Stone chipping is gravel fired at the part to check the housing/coating - it is
    // NOT the half-sine shock pulse test it was matching (IEC 60068-2-27).
    {
        match: /stone\s*(impact|chip|chipping|pelting)|gravel|chipping\s*resistance|shot[\s-]*blast\s*resistance/i,
        standard: "ISO 20567-1 / SAE J400 (Stone-chip resistance)",
        hazard: "the housing, coating or connector being damaged by flying road stones",
        reasonPass: "the housing and coating showed no chipping, cracking or exposure beyond the specified rating, and the part stayed sealed and functional",
        reasonFail: "the surface chipped or cracked beyond the allowed rating, or the {n} lost sealing/function, resulting in rejection",
        procedure: [[
            "The {n} is mounted in a stone-chip (multi-impact) tester in its in-vehicle orientation, with the surfaces that face the road exposed.",
            "The specified chilled-iron shot or graded gravel is fired at the sample with compressed air at the specified pressure, quantity and angle (ISO 20567-1 Method A, or SAE J400).",
            "The test is run at the specified temperature - typically also repeated at low temperature (for example -20 degC), where the coating is most brittle.",
            "The surface is cleaned and the damage is rated against the standard's chipping scale, counting and sizing the chips and checking whether the substrate is exposed.",
            "The {n} is then checked for sealing (IP retest where required) and for correct electrical output after the exposure.",
            "The chipping rating and the post-test function are compared with the specification."
        ]]
    },

    // ---- Handlebar controls / switchgear (IEC 60947-5-1 / IS 6875) ----
    // The functional switch tests for a combination / handlebar switch assembly.

    {
        match: /switch\s*function|switch\s*operation|control\s*function|handlebar\s*control|combination\s*switch|functional.{0,10}(switch|control)|individual\s*control|operate\s*each|switch\s*gear\s*function/i,
        standard: "IEC 60947-5-1 / IS 6875 / product specification (Control-switch function)",
        hazard: "a switch failing to perform its intended control function",
        reasonPass: "every switch operated its intended function correctly, with continuity, contact resistance and response within the specified limits",
        reasonFail: "one or more switches did not operate correctly, stuck, or fell outside the continuity / resistance / response limits, resulting in {n} rejection",
        procedure: [[
            "The handlebar control assembly is mounted securely on the test fixture or handlebar and connected to the vehicle wiring harness (or a bench supply) as per the wiring diagram.",
            "Each control is operated individually and its function verified - horn, left / right indicator, headlamp ON/OFF, high / low beam, pass (flash), hazard, mode (Eco/Sport) and start / stop or engine-kill switch, as applicable.",
            "For each switch the contact continuity, contact resistance, operating voltage and response are checked with the appropriate test equipment.",
            "The assembly is checked for smooth actuation and correct detent / return, with no sticking or intermittent contact, and every reading is compared with the specification."
        ]]
    },

    {
        // An insulation / earth tester is judged on the voltage IT puts out.
        match: /test\s*voltage\s*output|output\s*voltage\s*accuracy|open[\s-]*circuit\s*(test\s*)?voltage/i,
        standard: "IEC 61557-2 / IEC 61557-4 (Test voltage output)",
        hazard: "a tester that applies the wrong voltage, so its readings mean nothing",
        reasonPass: "the open-circuit and loaded test voltages were within the tolerance of the standard at every range",
        reasonFail: "a test voltage was outside the specified tolerance, resulting in {n} rejection",
        procedure: [[
            "The {n} is connected to a calibrated high-voltage meter with a high input resistance.",
            "Each test range is selected in turn and the open-circuit output voltage is measured.",
            "A specified reference load is applied and the loaded output voltage and current are measured.",
            "Both voltages are checked against the tolerance the standard allows for each range."
        ]]
    },

    {
        // Load cells / force sensors are calibrated with dead weights (OIML R60),
        // not swept over a throttle's travel.
        match: /load\s*cell.{0,30}(linearity|hysteresis|repeatab)|force\s*sensor.{0,30}(linearity|hysteresis|repeatab)/i,
        standard: "OIML R60 / product specification (Load cell linearity, hysteresis and repeatability)",
        hazard: "wrong force or weight readings across the measuring range",
        reasonPass: "the non-linearity, hysteresis and repeatability errors were all within the specified accuracy class",
        reasonFail: "the non-linearity, hysteresis or repeatability error exceeded the accuracy class, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted in its load frame, excited at the rated voltage and warmed up for 30 minutes.",
            "Calibrated weights are applied in about five equal steps up to the rated capacity, then removed in the same steps.",
            "The output is recorded at every step, and the whole loading run is repeated three times.",
            "Non-linearity, hysteresis and repeatability are calculated and checked against the accuracy class."
        ]]
    },

    {
        match: /load\s*cell.{0,20}creep|creep.{0,20}load\s*cell|force\s*sensor.{0,20}creep/i,
        standard: "OIML R60 / product specification (Load cell creep)",
        hazard: "the reading drifting while a constant load is held",
        reasonPass: "the output change under constant load and the return to zero were within the specified creep limit",
        reasonFail: "the output drifted beyond the creep limit under constant load, resulting in {n} rejection",
        procedure: [[
            "The {n} is excited at the rated voltage, warmed up and its zero output recorded.",
            "A load of 90 to 100% of the rated capacity is applied quickly and held for 30 minutes.",
            "The output is recorded at the start and at set times during the 30 minutes, then after the load is removed.",
            "The change in output and the return to zero are checked against the creep limit."
        ]]
    },

    {
        match: /load\s*cell.{0,30}(zero\s*balance|rated\s*output|sensitivity)|(zero\s*balance|rated\s*output).{0,30}load\s*cell/i,
        standard: "OIML R60 / product specification (Zero balance and rated output)",
        hazard: "an offset or wrong sensitivity giving wrong readings",
        reasonPass: "the zero balance and rated output (mV/V) were within the specified tolerance",
        reasonFail: "the zero balance or rated output was outside the specified tolerance, resulting in {n} rejection",
        procedure: [[
            "The {n} is excited at the rated voltage with no load and its output (mV/V) is recorded as the zero balance.",
            "The rated capacity is applied with calibrated weights and the output is recorded.",
            "The rated output is the loaded output minus the zero output, in mV/V.",
            "The zero balance and rated output are checked against the datasheet tolerance."
        ]]
    },

    {
        // A switch's contacts are measured closed by operating the switch - not
        // "fully mated" like a connector (IEC 60512 template further down).
        match: /switch\s*contact\s*resistance|contact\s*resistance.{0,15}switch/i,
        standard: "IEC 61058-1 / IS 6875 (Switch contact resistance)",
        hazard: "high contact resistance heating the switch or dropping the circuit voltage",
        reasonPass: "the contact resistance of every switch position was below the specified maximum and stable over repeated operations",
        reasonFail: "a contact resistance was above the specified maximum or unstable, resulting in {n} rejection",
        procedure: [[
            "The {n} is operated to each ON position in turn and a 4-wire micro-ohmmeter is connected across the closed contacts.",
            "The resistance is measured at the specified test current (for example 1 A at 6 V DC).",
            "The switch is operated several times and the measurement is repeated to check it is stable.",
            "Each contact resistance is compared with the specified maximum."
        ]]
    },

    {
        match: /operating\s*force|actuation\s*force|switch\s*force|operating\s*effort|actuation\s*effort|push\s*force|tactile\s*force/i,
        standard: "IS 6875 / product specification (Operating / actuation force)",
        hazard: "operating force outside the comfortable / specified range",
        reasonPass: "the operating force of every control stayed within the specified minimum and maximum",
        reasonFail: "a switch needed more or less force than specified, or lost its detent feel, resulting in {n} rejection",
        procedure: [[
            "Each switch or button is actuated with a calibrated force gauge along its normal direction of operation.",
            "The force required to reach the operating point (and, where relevant, the release point) is measured.",
            "The operating force is recorded for every control and compared with the specified minimum and maximum.",
            "The tactile feel and detent are checked so the switch is neither too stiff nor too loose."
        ]]
    },

    {
        match: /switch\s*(endurance|durability|cycle\s*life)|(operating|switching)\s*(cycles|endurance|life)|contact\s*(endurance|life)/i,
        standard: "IEC 60947-5-1 / IS 6875 (Switch operating endurance)",
        hazard: "contact wear or resistance rise after many operations",
        reasonPass: "after the full number of operations the switch still functioned with contact resistance and continuity within limits",
        reasonFail: "the contacts wore, stuck or rose in resistance beyond the limit after cycling, resulting in {n} failure",
        procedure: [[
            "The switch / control is connected to a rated electrical load and to an automatic actuator.",
            "It is operated for the specified number of cycles (for example 10,000 to 50,000 operations) at the specified rate.",
            "At set intervals the contact resistance, continuity and correct function are re-checked.",
            "After the full count the switch is checked for sticking, contact wear, resistance rise and correct operation against the limits."
        ]]
    },

    {
        match: /contact\s*bounce|bounce\s*time|debounce|response\s*time|switch\s*response|make.{0,3}break\s*time/i,
        standard: "Product specification (Contact bounce / response time)",
        hazard: "excessive contact bounce or slow response causing mis-triggering",
        reasonPass: "the contact-bounce duration and switch response time stayed within the specified maximum",
        reasonFail: "the contact bounce or response time exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The switch contacts are connected to an oscilloscope or a contact-bounce analyser.",
            "The switch is operated and the make / break signal is captured.",
            "The contact-bounce duration and the response (make / break) time are measured.",
            "The measured bounce and response times are compared with the specified maximum limits."
        ]]
    },

    // ---- Automotive electrical-stress tests (ISO 16750-2 / ISO 7637-2) ----
    // Standard road-vehicle supply-line tests. Placed before the surge / reverse-power
    // templates so they win for load-dump, reverse polarity, transients, etc.

    {
        match: /reverse\s*polarity|reverse[\s-]*battery|reverse\s*supply/i,
        standard: "ISO 16750-2 (Reverse polarity)",
        hazard: "a reversed supply connection",
        reasonPass: "the {n} withstood the reverse-polarity supply without damage and worked normally afterwards",
        reasonFail: "the {n} was damaged or failed to work after the reverse-polarity condition, resulting in failure",
        procedure: [[
            "The {n} is connected to a supply set to the specified reverse-polarity voltage (for example -14 V for a 12 V system) through the correct source impedance.",
            "The reverse voltage is applied for the specified time (typically 60 seconds) while the current and temperature are monitored.",
            "The supply is returned to normal polarity and the {n} function is checked.",
            "The {n} passes if there is no damage and it operates correctly, with the reverse-polarity protection acting as intended."
        ]]
    },

    {
        match: /jump\s*start|jumpstart|jump[\s-]*start/i,
        standard: "ISO 16750-2 (Jump start)",
        hazard: "an elevated jump-start supply voltage",
        reasonPass: "the {n} withstood the jump-start over-voltage without damage and worked normally afterwards",
        reasonFail: "the {n} was damaged or malfunctioned during the jump-start over-voltage, resulting in failure",
        procedure: [[
            "The {n} is supplied at the elevated jump-start voltage (for example 24 V to 26 V for a 12 V system, or the specified level for a 24 V system).",
            "The over-voltage is held for the specified duration (typically 60 seconds) while the {n} operates and the temperature is monitored.",
            "The supply is returned to nominal and the {n} function and any protection reaction are checked.",
            "The {n} passes if it survives without damage and meets the required functional status class."
        ]]
    },

    {
        match: /load\s*dump/i,
        standard: "ISO 7637-2 (Pulse 5) / ISO 16750-2 (Load dump)",
        hazard: "a load-dump surge when the alternator load is disconnected",
        reasonPass: "the {n} withstood the specified load-dump pulses without damage or malfunction",
        reasonFail: "the {n} was damaged or malfunctioned during the load-dump pulses, resulting in failure",
        procedure: [[
            "The {n} is connected to the load-dump (Pulse 5) generator set to the specified clamped peak voltage, internal resistance and pulse duration.",
            "The specified number of load-dump pulses is applied at the required interval while the {n} operates.",
            "Both the suppressed (clamped) and, where required, unsuppressed variants are applied per the test plan.",
            "The {n} is monitored and afterwards checked for damage and correct function, and graded against the required status class."
        ]]
    },

    {
        match: /crank|cold[\s-]*crank|voltage\s*drop[\s-]*out|dropout|micro[\s-]*cut|start(ing)?\s*profile|voltage\s*dip|brown[\s-]*out|start\s*stop\s*profile/i,
        standard: "ISO 16750-2 (Supply voltage / starting profile)",
        hazard: "supply dips and dropouts during engine cranking / start-stop",
        reasonPass: "the {n} kept the required function (or reset cleanly) through the cranking dips and momentary dropouts",
        reasonFail: "the {n} reset unexpectedly, latched up or malfunctioned during the supply dips, resulting in failure",
        procedure: [[
            "The {n} is supplied through a programmable source able to reproduce the specified starting (cranking) voltage profile.",
            "The cranking profile is applied - the supply dips to the specified low level (for example down to 6 V) and recovers along the defined ramp - and repeated the required number of times.",
            "Momentary voltage dropouts (micro-cuts) of the specified duration are also applied.",
            "The {n} behaviour (continued operation, clean reset, no latch-up) is verified against the required functional status class."
        ]]
    },

    {
        match: /superimposed|ripple\s*voltage|ac\s*ripple|voltage\s*ripple|superimposed\s*ac/i,
        standard: "ISO 16750-2 (Superimposed alternating voltage)",
        hazard: "alternator AC ripple superimposed on the DC supply",
        reasonPass: "the {n} operated correctly with the specified AC ripple superimposed across the whole frequency sweep",
        reasonFail: "the {n} malfunctioned under the superimposed AC ripple, resulting in failure",
        procedure: [[
            "The {n} is supplied at nominal DC with the specified alternating voltage superimposed (for example up to 4 V peak-to-peak).",
            "The ripple frequency is swept over the specified range (typically 50 Hz to 25 kHz) at the required severity level.",
            "The {n} function and output are monitored throughout the sweep.",
            "The {n} passes if it operates correctly at every frequency without malfunction."
        ]]
    },

    {
        match: /iso\s*7637|transient\s*(pulse|immunit|voltage|test)|conducted\s*transient|pulse\s*immunit|fast\s*transient/i,
        standard: "ISO 7637-2 (Conducted transients on supply lines)",
        hazard: "conducted transient pulses on the supply lines",
        reasonPass: "the {n} withstood the specified ISO 7637-2 pulses and met the required functional status class",
        reasonFail: "the {n} malfunctioned or was damaged by the transient pulses, resulting in failure",
        procedure: [[
            "The {n} is connected to the transient (ISO 7637-2) generator on its supply lines with the specified coupling.",
            "The defined pulses (for example Pulse 1, 2a, 2b, 3a and 3b) are applied at the required test level and number of repetitions.",
            "The {n} is operated and monitored for resets, malfunction or corruption during each pulse train.",
            "The performance is graded (functional status Class A to D) and compared with the required acceptance class."
        ]]
    },

    // ---- Installation materials: adhesive / tape / sheet / film / foam / gasket ----
    // Material tests use ASTM / ISO material standards (peel, shear, tack, tensile...).

    {
        match: /peel\s*(adhesion|strength|test)|180\s*deg|90\s*deg\s*peel|adhesion\s*to\s*(steel|substrate)/i,
        standard: "ASTM D3330 / ISO 29862 (Peel adhesion)",
        hazard: "insufficient peel adhesion to the substrate",
        reasonPass: "the measured peel adhesion met or exceeded the specified minimum",
        reasonFail: "the peel adhesion was below the specified minimum, resulting in {n} rejection",
        procedure: [[
            "A strip of the {n} of the specified width is applied to a clean stainless-steel (or specified) test panel and rolled down with the standard roller.",
            "After the specified dwell time the free end is clamped in a tensile tester and peeled at 180° (or 90°) at the specified rate (typically 300 mm/min).",
            "The force required to peel the tape is recorded continuously over the peel length.",
            "The average peel adhesion (N per 25 mm, or N/cm) is calculated and compared with the specified value."
        ]]
    },

    {
        match: /shear\s*adhesion|holding\s*power|static\s*shear|dwell\s*shear/i,
        standard: "ASTM D3654 / PSTC-107 (Shear adhesion / holding power)",
        hazard: "the adhesive creeping or slipping under a sustained load",
        reasonPass: "the {n} held the specified load for the required time without slipping or failing",
        reasonFail: "the {n} slipped or failed before the required holding time, resulting in rejection",
        procedure: [[
            "A specified overlap area of the {n} is bonded to a vertical steel panel and rolled down.",
            "After the dwell time a standard weight (for example 1 kg) is hung from the free end so the bond is loaded in shear.",
            "The time taken for the tape to slip a set distance or fully detach is recorded.",
            "The holding time (or the slippage) is compared with the specified minimum."
        ]]
    },

    {
        match: /lap\s*shear|tensile\s*shear|shear\s*strength\s*(of\s*)?(adhesive|bond|joint)|bond\s*strength/i,
        standard: "ASTM D1002 / ISO 4587 (Lap-shear strength)",
        hazard: "insufficient bonded shear strength",
        reasonPass: "the measured lap-shear strength met or exceeded the specified minimum",
        reasonFail: "the lap-shear strength was below the specified minimum, resulting in {n} rejection",
        procedure: [[
            "Two specified substrates are bonded with the {n} over the defined overlap area and cured under the specified conditions.",
            "The bonded joint is clamped in a tensile tester and pulled in shear at the specified rate until failure.",
            "The maximum load at failure and the failure mode (adhesive, cohesive or substrate) are recorded.",
            "The shear strength (load divided by bond area, in MPa) is calculated and compared with the specification."
        ]]
    },

    {
        match: /\btack\b|loop\s*tack|rolling\s*ball|initial\s*tack|quick\s*stick/i,
        standard: "ASTM D6195 / FTM-9 (Tack)",
        hazard: "insufficient initial tack (quick-stick)",
        reasonPass: "the measured tack met or exceeded the specified minimum",
        reasonFail: "the tack was below the specified minimum, resulting in {n} rejection",
        procedure: [[
            "A loop of the {n} is formed with the adhesive facing outward and brought into contact with the test panel over the specified area with no added pressure.",
            "The loop is immediately withdrawn at the specified rate in the tensile tester.",
            "The maximum force to separate the loop from the panel is recorded (loop-tack), or the rolling-ball distance is measured for the ball-tack method.",
            "The tack value is compared with the specified minimum."
        ]]
    },

    {
        match: /tensile\s*strength|elongation|break\s*strength|tensile\s*(test|propert)|ultimate\s*tensile/i,
        standard: "ASTM D3759 / ASTM D882 / ISO 37 (Tensile strength & elongation)",
        hazard: "insufficient tensile strength or elongation",
        reasonPass: "the tensile strength and elongation at break met or exceeded the specified minimums",
        reasonFail: "the tensile strength or elongation was below the specified minimum, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} of the specified width and length is clamped in the tensile tester at the specified gauge length.",
            "It is pulled at the specified constant rate (for example 300 mm/min) until it breaks.",
            "The maximum force and the elongation at break are recorded.",
            "The tensile strength (N per width, or MPa) and the elongation (%) are calculated and compared with the specification."
        ]]
    },

    {
        match: /(film|sheet|tape|material|adhesive|foam|liner)\s*thickness|thickness\s*(measurement|gaug)|\bcaliper\b|\bgsm\b|basis\s*weight/i,
        standard: "ASTM D3652 / ISO 4593 (Thickness)",
        hazard: "thickness outside the specified tolerance",
        reasonPass: "the measured thickness was within the specified tolerance across the sample",
        reasonFail: "the thickness was outside the specified tolerance, resulting in {n} rejection",
        procedure: [[
            "The {n} is conditioned at the standard atmosphere (for example 23 °C, 50% RH) for the specified time.",
            "A calibrated dead-weight micrometer (or thickness gauge) with the specified anvil pressure is used to measure the thickness.",
            "Measurements are taken at several points across the width and length of the sample.",
            "The average thickness and its variation are compared with the specified nominal and tolerance."
        ]]
    },

    {
        match: /shore\s*[a-d]?\b|durometer|indentation\s*hardness|hardness.*(rubber|elastomer|polymer|plastic|foam|coating|adhesive)/i,
        standard: "ASTM D2240 / ISO 868 (Shore hardness)",
        hazard: "hardness outside the specified range",
        reasonPass: "the measured Shore hardness was within the specified range",
        reasonFail: "the hardness was outside the specified range, resulting in {n} rejection",
        procedure: [[
            "The {n} sample is conditioned and placed on a hard, flat surface with the specified minimum thickness (stacking layers if needed).",
            "The Shore durometer (type A for soft, type D for hard) is pressed onto the surface with the specified force.",
            "The reading is taken at the specified time (typically 1 s or 3 s) after full contact, at several points.",
            "The average Shore hardness is compared with the specified value and tolerance."
        ]]
    },

    {
        match: /dielectric\s*breakdown|breakdown\s*voltage.*(tape|film|sheet|material|insulat)|astm\s*d149|iec\s*60243/i,
        standard: "ASTM D149 / IEC 60243 (Dielectric breakdown)",
        hazard: "dielectric breakdown below the required voltage",
        reasonPass: "the dielectric breakdown voltage met or exceeded the specified minimum",
        reasonFail: "the material broke down below the specified voltage, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} is placed between the specified electrodes, immersed in insulating oil where required.",
            "An AC (or DC) voltage is raised at the specified rate until the material breaks down (short circuit / puncture).",
            "The breakdown voltage is recorded and divided by the material thickness to give the electric strength (kV/mm).",
            "The breakdown voltage and electric strength are compared with the specified minimum."
        ]]
    },

    {
        match: /heat\s*aging|thermal\s*aging|oven\s*aging|adhesion\s*retention|aging.{0,15}(tape|adhesive|sheet|material|film|bond)/i,
        standard: "ASTM D3611 / heat-aging (Adhesion retention)",
        hazard: "loss of adhesion or embrittlement after heat aging",
        reasonPass: "after heat aging the {n} retained the specified adhesion and showed no embrittlement or residue",
        reasonFail: "the {n} lost adhesion, embrittled or left residue after heat aging, resulting in failure",
        procedure: [[
            "Samples of the {n} are applied to the specified panels and placed in an air-circulating oven at the specified temperature.",
            "They are aged for the specified time (for example 168 hours at 70 °C or as required).",
            "After conditioning back to standard atmosphere, the peel adhesion is re-measured and the residue / embrittlement is inspected.",
            "The retained adhesion and appearance are compared with the initial values and the acceptance limits."
        ]]
    },

    {
        match: /chemical\s*resist|solvent\s*resist|fluid\s*resist|oil\s*resist|reagent\s*resist/i,
        standard: "ASTM D896 / ISO 175 (Chemical / solvent resistance)",
        hazard: "degradation on contact with fluids or solvents",
        reasonPass: "the {n} resisted the specified fluids with no unacceptable change in properties or adhesion",
        reasonFail: "the {n} softened, dissolved, swelled or lost adhesion after fluid exposure, resulting in failure",
        procedure: [[
            "Samples of the {n} are exposed to each specified fluid (for example oil, coolant, fuel, cleaning solvent) by immersion or wiping.",
            "They are held at the specified temperature for the specified time.",
            "After exposure the samples are examined for softening, swelling, dissolution, discolouration and change in adhesion / strength.",
            "The change in the measured properties is compared with the acceptance limits."
        ]]
    },

    {
        match: /uv\s*(resist|expos|test|weather)|weathering|xenon\s*arc|q_?uv|accelerated\s*weather|sunlight\s*(resist|expos)/i,
        standard: "ASTM G154 / ISO 4892 (UV / weathering)",
        hazard: "degradation from UV / weathering",
        reasonPass: "after the weathering exposure the {n} showed no unacceptable cracking, fading, chalking or loss of adhesion",
        reasonFail: "the {n} cracked, faded, chalked or lost adhesion after weathering, resulting in failure",
        procedure: [[
            "Samples of the {n} are mounted in a UV (fluorescent or xenon-arc) weathering chamber.",
            "They are exposed to repeated cycles of UV light and condensation (or spray) at the specified irradiance and temperature.",
            "The exposure is continued for the specified number of hours or cycles.",
            "The colour change, gloss, cracking, chalking and adhesion are measured afterwards and compared with the acceptance limits."
        ]]
    },

    {
        match: /water\s*absorption|moisture\s*absorption|water\s*uptake|astm\s*d570/i,
        standard: "ASTM D570 / ISO 62 (Water absorption)",
        hazard: "excessive water absorption changing the properties",
        reasonPass: "the measured water absorption was within the specified limit",
        reasonFail: "the water absorption exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} is dried, conditioned and weighed to get the dry mass.",
            "It is immersed in distilled water at the specified temperature (for example 23 °C) for the specified time (for example 24 hours).",
            "It is removed, surface-dried and re-weighed to get the wet mass.",
            "The water absorption is calculated as the percentage mass gain and compared with the specified limit."
        ]]
    },

    {
        match: /low[\s-]?temp\w*\s*(flex|bend|unwind)|cold\s*flex|flexibility|cold\s*bend|brittleness|astm\s*d2137|iec\s*60811/i,
        standard: "IEC 60811-504 / ASTM D2137 (Low-temperature flexibility / brittleness)",
        hazard: "cracking or stiffening at low temperature",
        reasonPass: "the {n} stayed flexible with no cracking after the low-temperature conditioning",
        reasonFail: "the {n} cracked or became brittle at low temperature, resulting in failure",
        procedure: [[
            "A specimen of the {n} is conditioned at the specified low temperature (for example -20 °C or -40 °C) for the specified time.",
            "While still cold it is bent around a mandrel of the specified diameter (or wound onto a rod) at a steady rate.",
            "The specimen is examined for cracking, splitting or loss of adhesion.",
            "It passes only if there is no cracking or delamination at the specified low temperature."
        ]]
    },

    {
        match: /unwind|unroll|release\s*force|unwinding\s*force|astm\s*d3811/i,
        standard: "ASTM D3811 / PSTC-8 (Unwind force)",
        hazard: "unwind force too high or too low",
        reasonPass: "the measured unwind (release) force was within the specified range",
        reasonFail: "the unwind force was outside the specified range, resulting in {n} rejection",
        procedure: [[
            "A roll of the {n} is mounted on the unwind fixture of the tensile tester.",
            "The tape is unwound at the specified rate (for example 300 mm/min) at the specified angle.",
            "The force needed to unwind the tape from the roll is recorded over the length.",
            "The average unwind force is compared with the specified range."
        ]]
    },

    {
        match: /shrink|dimensional\s*stabilit|astm\s*d1204|heat\s*shrink/i,
        standard: "ASTM D1204 / ISO 11501 (Dimensional stability / shrinkage)",
        hazard: "excessive shrinkage on heating",
        reasonPass: "the measured shrinkage was within the specified limit in both directions",
        reasonFail: "the shrinkage exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} is marked with reference gauge lines and measured accurately in the machine and cross directions.",
            "It is placed unrestrained in an oven at the specified temperature for the specified time (for example 30 minutes).",
            "After cooling to room temperature the gauge lines are re-measured.",
            "The percentage dimensional change (shrinkage) in each direction is calculated and compared with the limit."
        ]]
    },

    {
        match: /volume\s*resistiv|surface\s*resistiv|resistivit|astm\s*d257/i,
        standard: "ASTM D257 / IEC 62631 (Volume / surface resistivity)",
        hazard: "resistivity outside the specified value",
        reasonPass: "the measured volume and surface resistivity met the specified requirement",
        reasonFail: "the resistivity was outside the specified value, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} is placed between the guarded electrodes of the resistivity cell after conditioning.",
            "A specified DC voltage (for example 500 V) is applied and the current is measured after the specified electrification time (for example 1 minute).",
            "The volume resistivity and surface resistivity are calculated from the current, voltage and electrode geometry.",
            "The measured resistivity is compared with the specified requirement."
        ]]
    },

    {
        match: /coat\s*weight|adhesive\s*mass|areal\s*(weight|mass)|specific\s*gravity|astm\s*d792|(film|material|sheet|coating)\s*density/i,
        standard: "ASTM D792 / ISO 1183 (Density / specific gravity)",
        hazard: "density / coat weight outside the specified value",
        reasonPass: "the measured density (or coat weight) was within the specified tolerance",
        reasonFail: "the density / coat weight was outside the specified tolerance, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} is weighed in air on a precision balance.",
            "For density it is then weighed while immersed in water (Archimedes method); for coat weight a known area is weighed before and after removing the coating.",
            "The density (g/cm³) or the coat weight (g/m²) is calculated.",
            "The result is compared with the specified nominal value and tolerance."
        ]]
    },

    // ---- Electrical-safety PPE: insulating gloves / mats / blankets / sleeves ----
    // Placed before the motor block so a glove's dielectric test is not read as a
    // motor winding test. Use ASTM D120 / IEC 60903 / EN 388.

    {
        match: /proof[\s-]?voltage|astm\s*d120|iec\s*60903|dielectric\s*proof|(glove|mat|blanket|sleeve).{0,20}(dielectric|withstand|proof|breakdown)|(dielectric|withstand|proof).{0,20}(glove|mat|blanket|sleeve)/i,
        standard: "ASTM D120 / IEC 60903 (Dielectric proof-voltage)",
        hazard: "electrical breakdown of the insulating rubber",
        reasonPass: "the {n} withstood the class proof voltage with the leakage current below the allowed limit and no puncture",
        reasonFail: "the {n} broke down, punctured or exceeded the leakage-current limit, resulting in failure",
        procedure: [[
            "The {n} is filled with water and immersed in a water bath to the specified depth, leaving the defined flashover clearance dry at the cuff.",
            "The AC proof-test voltage for the glove class is applied between the inside and outside water for the specified time (for example Class 0 = 5 kV AC, Class 2 = 20 kV AC, held 1 or 3 minutes).",
            "The leakage current through the {n} is measured and must stay below the maximum allowed for its class and size.",
            "The {n} is inspected for puncture, breakdown, or excessive leakage, and rejected if any occur."
        ]]
    },

    {
        match: /leakage\s*current/i,
        standard: "ASTM D120 / IEC 60903 (Leakage current)",
        hazard: "excessive leakage current through the insulation",
        reasonPass: "the measured leakage current stayed below the maximum allowed for the class and size",
        reasonFail: "the leakage current exceeded the allowed limit, resulting in {n} rejection",
        procedure: [[
            "The {n} is set up in the water-immersion dielectric test with the electrodes as for the proof-voltage test.",
            "The AC test voltage for the class is applied and held steady.",
            "The steady-state leakage current (mA) flowing through the {n} is measured with a calibrated meter.",
            "The leakage current is compared with the maximum allowed value for the glove class and size."
        ]]
    },

    {
        match: /cut\s*resist|iso\s*13997|blade\s*cut|coup\s*test|en\s*388.*cut|cut\s*level|cut\s*through/i,
        standard: "EN 388 / ISO 13997 / ASTM F2992 (Cut resistance)",
        hazard: "the material being cut through too easily",
        reasonPass: "the measured cut resistance met or exceeded the specified level",
        reasonFail: "the cut resistance was below the specified level, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} is mounted flat on the test fixture of the cut-resistance machine.",
            "A circular (coup test) or straight (ISO 13997 / TDM) blade is drawn across it under the specified load.",
            "The number of cycles (or the blade load) needed to cut through the material is recorded.",
            "The cut index or force is converted to the performance level and compared with the requirement."
        ]]
    },

    {
        match: /abrasion\s*resist|martindale|en\s*388.*abras|taber|abrasion\s*cycle/i,
        standard: "EN 388 / ASTM D3884 (Abrasion resistance)",
        hazard: "wearing through under abrasion",
        reasonPass: "the {n} withstood the required number of abrasion cycles without breakthrough",
        reasonFail: "the {n} wore through before the required cycles, resulting in rejection",
        procedure: [[
            "A specimen of the {n} is clamped in the abrasion machine and loaded against the specified abrasive paper.",
            "It is rubbed under the specified pressure in a Lissajous (or rotary) motion.",
            "The number of cycles to the first hole (breakthrough) is recorded.",
            "The abrasion cycles are converted to the EN 388 level and compared with the requirement."
        ]]
    },

    {
        match: /tear\s*resist|trouser\s*tear|tear\s*strength|en\s*388.*tear/i,
        standard: "EN 388 / ASTM D624 (Tear resistance)",
        hazard: "tearing under load",
        reasonPass: "the measured tear force met or exceeded the specified minimum",
        reasonFail: "the tear force was below the specified minimum, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} of the specified shape (for example trouser-leg) is clamped in the tensile tester.",
            "The two legs are pulled apart at the specified rate to propagate the tear.",
            "The maximum (or median) force to tear the material is recorded.",
            "The tear force is converted to the performance level and compared with the requirement."
        ]]
    },

    {
        match: /puncture\s*resist|penetration\s*resist|en\s*388.*punctur|en\s*863|stylus\s*penetrat/i,
        standard: "EN 388 / EN 863 (Puncture resistance)",
        hazard: "being punctured by a sharp point",
        reasonPass: "the measured puncture force met or exceeded the specified minimum",
        reasonFail: "the puncture force was below the specified minimum, resulting in {n} rejection",
        procedure: [[
            "A specimen of the {n} is clamped over the test ring of the puncture tester.",
            "A standard steel stylus of the specified tip is driven through the specimen at the specified rate.",
            "The maximum force to puncture the material is recorded.",
            "The puncture force is converted to the EN 388 level and compared with the requirement."
        ]]
    },

    {
        match: /ozone\s*(resist|crack|expos|test)?/i,
        standard: "ASTM D1149 / IEC 60903 (Ozone resistance)",
        hazard: "ozone cracking of the rubber",
        reasonPass: "the {n} showed no ozone cracking after the specified exposure",
        reasonFail: "the {n} developed ozone cracks, resulting in rejection",
        procedure: [[
            "A specimen of the {n} is stretched to the specified elongation on a test mandrel.",
            "It is placed in an ozone chamber at the specified ozone concentration and temperature.",
            "It is exposed for the specified time (for example 3 hours at the required ppm).",
            "The specimen is examined under magnification for cracks; it passes only if no cracking is seen."
        ]]
    },

    {
        match: /arc[\s-]?flash|arc\s*rating|astm\s*f2675|arc\s*resist|\batpv\b|incident\s*energy/i,
        standard: "ASTM F2675 / IEC 61482 (Arc-flash rating)",
        hazard: "insufficient protection against an electric arc",
        reasonPass: "the measured arc rating (ATPV / EBT) met or exceeded the required value",
        reasonFail: "the arc rating was below the required value, resulting in {n} rejection",
        procedure: [[
            "Specimens of the {n} are mounted in front of the arc-test electrodes with calorimeter sensors behind them.",
            "A controlled electric arc of the specified energy is generated for the specified duration.",
            "The incident energy transmitted through the material is measured, over several exposures at different energies.",
            "The Arc Thermal Performance Value (ATPV) or breakopen threshold (EBT) is calculated and compared with the requirement."
        ]]
    },

    // ---- Oscilloscope performance tests (manufacturer spec / traceable calibration) ----

    {
        match: /vertical.{0,3}(gain|accuracy|amplitude)|amplitude.{0,3}accuracy|dc\s*gain|volts?\s*[-/]?\s*div|gain\s*accuracy/i,
        standard: "Manufacturer specification / ISO-IEC 17025 (Vertical / DC gain accuracy)",
        hazard: "vertical (amplitude) reading error beyond the specified accuracy",
        reasonPass: "the measured amplitude error was within the specified vertical accuracy on every range",
        reasonFail: "the amplitude error exceeded the specified vertical accuracy, resulting in {n} rejection",
        procedure: [[
            "A traceable DC (and AC) reference source (for example an oscilloscope calibrator) is connected to each channel input at the specified impedance.",
            "Known amplitudes are applied on each volts/division setting, at several points of the screen graticule.",
            "The value measured by the scope is compared with the reference and the gain / DC accuracy error is recorded.",
            "The worst-case error on every range is compared with the specified vertical accuracy (for example ±1.5% or ±2% of full scale)."
        ]]
    },

    {
        match: /timebase|time\s*base|horizontal\s*accuracy|sweep\s*(accuracy|speed)|delta[\s-]?t\s*accuracy|time\s*measurement\s*accuracy/i,
        standard: "Manufacturer specification / ISO-IEC 17025 (Timebase accuracy)",
        hazard: "timebase (horizontal) error beyond the specified accuracy",
        reasonPass: "the timebase error was within the specified accuracy on every sweep speed",
        reasonFail: "the timebase error exceeded the specified accuracy, resulting in {n} rejection",
        procedure: [[
            "A traceable frequency / time-marker reference is applied to the input at several time/division settings.",
            "The period (or marker spacing) measured by the scope is compared with the reference across the screen.",
            "The timebase (delta-t) error is calculated on each sweep speed.",
            "The worst-case error is compared with the specified timebase accuracy (for example ±25 ppm or ±0.01%)."
        ]]
    },

    {
        match: /bandwidth|[-\s]?3\s*db|frequency\s*response|analog\s*bandwidth|passband/i,
        standard: "Manufacturer specification / ISO-IEC 17025 (Bandwidth)",
        hazard: "analogue bandwidth below the specified value",
        reasonPass: "the measured -3 dB bandwidth met or exceeded the specified value on every channel",
        reasonFail: "the bandwidth was below the specified value, resulting in {n} rejection",
        procedure: [[
            "A levelled sine-wave generator is connected to each channel and set to a reference amplitude at a low reference frequency.",
            "The frequency is increased while the input level is kept constant (levelled) and the displayed amplitude is monitored.",
            "The -3 dB point (where the amplitude falls to 70.7% of the reference) is recorded for each channel.",
            "The measured -3 dB bandwidth is compared with the specified analogue bandwidth."
        ]]
    },

    {
        match: /rise\s*time|risetime|fall\s*time/i,
        standard: "Manufacturer specification (Rise time)",
        hazard: "rise time slower than the specified value",
        reasonPass: "the measured rise time was within the specified value",
        reasonFail: "the rise time was slower than specified, resulting in {n} rejection",
        procedure: [[
            "A fast-edge pulse generator (edge much faster than the scope) is connected to the channel at the specified impedance.",
            "The channel is set to the fastest range and the 10% to 90% rise time of the displayed edge is measured.",
            "The measured value is corrected for the generator edge where required (system rise time).",
            "The rise time is compared with the specification and cross-checked against the bandwidth (approximately 0.35 / bandwidth)."
        ]]
    },

    {
        match: /trigger\s*(sensitivity|jitter|accuracy|level|test|stability)/i,
        standard: "Manufacturer specification (Trigger sensitivity / jitter)",
        hazard: "the scope failing to trigger stably at the specified level",
        reasonPass: "the scope triggered stably at the specified sensitivity with jitter within limit",
        reasonFail: "the scope failed to trigger at the specified sensitivity or the jitter exceeded the limit, resulting in {n} rejection",
        procedure: [[
            "A sine / pulse signal of known amplitude and frequency is applied to the channel.",
            "The signal amplitude is reduced until the scope just triggers stably, giving the trigger sensitivity, over the specified frequency range.",
            "The trigger jitter is measured on a fast repetitive edge using the scope's statistics.",
            "The sensitivity and jitter are compared with the specification (for example 0.5 division to full bandwidth, jitter < a few ps rms)."
        ]]
    },

    {
        match: /input\s*impedance|input\s*capacitance|termination\s*impedance|1\s*m[ω\w]*\s*input|50\s*[ωo]hm\s*input/i,
        standard: "Manufacturer specification / IEC 61010 (Input impedance)",
        hazard: "input impedance / capacitance outside the specified value",
        reasonPass: "the input impedance and capacitance were within the specified tolerance on every channel",
        reasonFail: "the input impedance or capacitance was out of tolerance, resulting in {n} rejection",
        procedure: [[
            "Each channel input is measured with a calibrated LCR / impedance meter at the specified frequency.",
            "The DC input resistance (for example 1 MΩ or 50 Ω) and the input capacitance are recorded for every channel and coupling.",
            "Any switchable termination (1 MΩ / 50 Ω) is checked in each position.",
            "The measured impedance and capacitance are compared with the specified values and tolerance."
        ]]
    },

    {
        match: /sample\s*rate|sampling\s*rate|record\s*length|acquisition\s*(rate|memory|test)|real[\s-]?time\s*sampl|effective\s*bits|\benob\b/i,
        standard: "Manufacturer specification / IEEE 1057 (Sample rate / acquisition)",
        hazard: "sample rate, record length or resolution below specification",
        reasonPass: "the sample rate, record length and effective resolution met the specification",
        reasonFail: "the sample rate, record length or resolution was below specification, resulting in {n} rejection",
        procedure: [[
            "A known high-frequency sine is applied and the maximum real-time sample rate per channel is verified from the acquisition settings and reconstructed waveform.",
            "The maximum record length (memory depth) is captured and confirmed at the fastest sample rate.",
            "Where required, the effective number of bits (ENOB) is measured by an FFT / sine-fit per IEEE 1057.",
            "The sample rate, record length and ENOB are compared with the specification."
        ]]
    },

    // ---- Measuring instruments: clamp meter / multimeter / tester / gauge ----
    // Hand-held test & measurement equipment - IEC 61010 (safety), IEC 61326 (EMC).

    {
        match: /cat\s*(rating|ii|iii|iv|\bi\b)|measurement\s*category|transient\s*overvoltage|impulse\s*withstand|overvoltage\s*category|working\s*voltage\s*rating/i,
        standard: "IEC 61010-1 (Measurement category / transient overvoltage)",
        hazard: "transient overvoltage above the CAT rating",
        reasonPass: "the {n} withstood the CAT impulse voltage for its category without breakdown or hazard",
        reasonFail: "the {n} broke down or became unsafe under the CAT impulse, resulting in failure",
        procedure: [[
            "The {n} is set to each measurement function and connected to the impulse generator at its input terminals.",
            "The impulse voltage for the declared measurement category and working voltage is applied (for example CAT III 600 V = a 6 kV, 1.2/50 µs impulse), a set number of times of each polarity.",
            "The impulse is applied between the inputs and between the inputs and the accessible surface / earth.",
            "The {n} passes if there is no disruptive discharge, breakdown or hazard and it still functions and reads correctly afterwards."
        ]]
    },

    {
        match: /voltage\s*withstand|withstand\s*voltage|iec\s*61010.*(dielectric|insulation|withstand)|(dielectric|insulation).*iec\s*61010/i,
        standard: "IEC 61010-1 (Voltage withstand & insulation)",
        hazard: "insulation breakdown between the inputs and the accessible surface",
        reasonPass: "the {n} withstood the test voltage with the leakage/insulation within the IEC 61010 limits",
        reasonFail: "the {n} broke down or exceeded the leakage limit, resulting in failure",
        procedure: [[
            "The {n} inputs are shorted together and the test voltage is applied between them and the accessible conductive surfaces (or foil-wrapped enclosure).",
            "The AC voltage required for the rated working voltage and pollution degree is applied and held for 1 minute (IEC 61010-1).",
            "The insulation resistance is also measured at the specified DC voltage between the same points.",
            "The {n} passes if there is no flashover or breakdown and the leakage current / insulation resistance meets the IEC 61010 limit."
        ]]
    },

    {
        match: /iec\s*61326|emc.*(meter|instrument|measur)|(meter|instrument|measur).*emc|emc\s*for\s*measur/i,
        standard: "IEC 61326-1 (EMC for measurement equipment)",
        hazard: "EMC emissions or susceptibility outside the IEC 61326 limits",
        reasonPass: "the {n} met the IEC 61326 emission limits and kept its reading accuracy under the immunity tests",
        reasonFail: "the {n} exceeded the emission limits or its reading drifted under immunity, resulting in failure",
        procedure: [[
            "The {n} is set up in its normal measuring mode in the EMC chamber per IEC 61326-1.",
            "Conducted and radiated emissions are measured against the Group 1 Class B (or A) limits.",
            "Immunity tests are applied - ESD, radiated RF, EFT/burst, surge and conducted RF at the basic-standard levels.",
            "During immunity the reading error and function are checked against the specified performance criterion (the reading must stay within the stated accuracy)."
        ]]
    },

    {
        match: /battery\s*life|low[\s-]?battery|battery\s*indicat|battery\s*endurance|operating\s*time|auto[\s-]?power[\s-]?off|auto\s*off/i,
        standard: "Product specification (Battery life / low-battery)",
        hazard: "short battery life or no low-battery warning",
        reasonPass: "the {n} met the specified battery life and gave a correct low-battery indication before accuracy was affected",
        reasonFail: "the battery life was short or the low-battery warning failed, resulting in {n} rejection",
        procedure: [[
            "A fresh (or fully charged) battery is fitted and the {n} is run in its normal measuring mode continuously (or per the specified duty).",
            "The operating time until the low-battery indicator appears and until the {n} stops reading within accuracy is recorded.",
            "The reading accuracy is checked as the battery voltage falls to confirm it stays in tolerance until the low-battery warning.",
            "The battery life and the low-battery / auto-power-off behaviour are compared with the specification."
        ]]
    },

    {
        match: /clamp\s*(jaw|opening|position|sensitiv|accuracy)|jaw\s*(opening|position|closure)|conductor\s*position|position\s*sensitiv/i,
        standard: "IEC 61010-2-032 / product specification (Clamp jaw)",
        hazard: "reading error with conductor position in the jaw",
        reasonPass: "the {n} read within accuracy for every conductor position in the jaw and the jaw opened/closed correctly",
        reasonFail: "the reading varied beyond accuracy with conductor position, or the jaw stuck, resulting in rejection",
        procedure: [[
            "A calibrated reference current is passed through a single conductor and the {n} clamp is closed around it.",
            "The conductor is moved to several positions inside the jaw (centre, edges, corners) and the reading is recorded at each.",
            "The jaw opening/closing action and the trigger are checked for smooth, full operation and correct core alignment.",
            "The position sensitivity (the spread of readings) is compared with the specified accuracy for the clamp."
        ]]
    },

    // ---- Cable glands / fittings / conduit / grommets (IEC 62444) ----
    // Passive sealing fittings - placed before the motor block so their torque /
    // retention tests are not read as motor tests.

    {
        // Not a bare "cable pull" or "grip force": first-match-wins, so a
        // throttle's "Cable Pull Test" or a handlebar "Grip Force Test" was
        // printed with this cable-GLAND retention procedure and IEC 62444.
        match: /cable\s*retention|cable\s*pull[\s-]?out|(cable|cord|gland)\s*retention\s*(force|test|strength)|clamping\s*(force|strength|test)|anchorage|(cable|cord|gland)\s*grip\s*(force|strength)/i,
        standard: "IEC 62444 / EN 62444 (Cable retention)",
        hazard: "the cable pulling out of the gland",
        reasonPass: "the gland held the cable against the required retention (pull-out) force without slipping",
        reasonFail: "the cable slipped or pulled out below the required force, resulting in {n} rejection",
        procedure: [[
            "The cable gland is assembled onto a cable of the specified diameter and tightened to the specified torque on a pull-test fixture.",
            "A steadily increasing axial pull is applied to the cable (or the specified proof load is held for 1 minute) with a tensile tester.",
            "The force at which the cable slips through the gland (or confirmation that it holds the proof load) is recorded.",
            "The retention force is compared with the minimum required for the gland size and cable range."
        ]]
    },

    {
        match: /assembly\s*torque|tightening\s*torque|clamping\s*torque|installation\s*torque|nut\s*torque|torque\s*(test|verif|check).{0,25}(gland|nut|thread|fitting|screw)/i,
        standard: "IEC 62444 / product specification (Assembly torque)",
        hazard: "thread stripping or a poor seal from incorrect assembly torque",
        reasonPass: "the gland withstood the specified assembly torque with no damage and gave a proper seal and grip",
        reasonFail: "the gland cracked, stripped or failed to seal at the assembly torque, resulting in rejection",
        procedure: [[
            "The gland is fitted to the enclosure and onto the cable following the installation instructions.",
            "The entry nut and sealing nut are tightened to the specified assembly torque with a calibrated torque wrench.",
            "The gland is checked for thread stripping, cracking or distortion at the assembly torque.",
            "The seal and cable retention are verified afterwards to confirm the assembly torque gives a proper seal and grip."
        ]]
    },

    {
        match: /impact\s*resist|\bik\b\s*(rating|test|code|class)|\bik0\d\b|impact\s*energy|iec\s*62262|mechanical\s*impact\s*(ik|energy|rating)/i,
        standard: "IEC 62262 (IK impact rating)",
        hazard: "cracking or loss of seal under mechanical impact",
        reasonPass: "the gland withstood the IK impact energy with no cracking and kept its IP seal",
        reasonFail: "the gland cracked or lost its seal under impact, resulting in rejection",
        procedure: [[
            "The gland is assembled on a representative enclosure/cable and mounted rigidly for the impact test.",
            "The impact energy for the declared IK code (for example IK08 = 5 J, IK10 = 20 J) is applied with a calibrated pendulum or spring hammer.",
            "The specified number of blows is applied at the specified points around the gland.",
            "The gland is inspected for cracks or breakage and the IP seal is re-checked - it passes only if the sealing is maintained."
        ]]
    },

    {
        match: /glow[\s-]?wire|iec\s*60695-2|\bgwit\b|\bgwfi\b|\bgwt\b/i,
        standard: "IEC 60695-2-11 / -2-12 (Glow-wire)",
        hazard: "ignition or flame spread from a hot wire (glow-wire)",
        reasonPass: "the material self-extinguished within the required time and did not ignite the underlay (GWIT/GWFI met)",
        reasonFail: "the material continued to burn or ignited the underlay, resulting in {n} failure",
        procedure: [[
            "A specimen of the gland material is mounted and the glow-wire is heated to the specified temperature (for example 650 °C or 960 °C).",
            "The tip of the glow-wire is pressed against the specimen with the specified force for 30 seconds.",
            "Any flame or glowing is timed as the glow-wire is withdrawn, and any ignition of the tissue-paper underlay is noted.",
            "The specimen passes if it self-extinguishes within the required time and does not ignite the underlay."
        ]]
    },

    // ---- Fasteners / hardware: washers / bolts / nuts / screws / rivets ----
    // Mechanical hardware - DIN / ISO 898 / IS 3063. Placed before the motor block
    // so fastener torque / loosening tests are not read as motor tests.

    {
        match: /dimensional|\bvisual\s*inspection\b|go[\s-]?no[\s-]?go|gaug(e|ing)|iso\s*4759|thread\s*(gauge|inspection)|dimension\s*check|profile\s*(check|inspection)/i,
        standard: "ISO 4759 / IS 3063 / product drawing (Dimensional & visual)",
        hazard: "dimensions or form outside the drawing tolerance",
        reasonPass: "every measured dimension and the form were within the drawing tolerance with no visual defects",
        reasonFail: "a dimension or the form was outside tolerance, or a visual defect was found, resulting in {n} rejection",
        procedure: [[
            "The specified dimensions of the {n} (outer/inner diameter, thickness, section, free height, gap) are measured with calibrated micrometers, callipers or a profile projector / CMM.",
            "Any threads are checked with go / no-go gauges and the surface is inspected for burrs, cracks, laps and plating defects.",
            "Several pieces from the lot are measured to assess consistency.",
            "All results are compared with the product drawing / standard tolerance."
        ]]
    },

    {
        match: /rockwell|vickers|brinell|\bhrc\b|\bhv\b|\bhrb\b|iso\s*6508|iso\s*6507|astm\s*e18|micro[\s-]?hardness|hardness.*(fastener|washer|bolt|nut|screw|steel|metal)/i,
        standard: "ISO 6508 / ASTM E18 / IS 1586 (Rockwell hardness)",
        hazard: "hardness outside the specified range",
        reasonPass: "the measured hardness was within the specified range",
        reasonFail: "the hardness was outside the specified range, resulting in {n} rejection",
        procedure: [[
            "A flat, clean surface of the {n} is prepared and placed on the hardness tester anvil.",
            "The Rockwell (HRC) indenter is applied with the specified minor and major loads (or Vickers HV for thin parts).",
            "The hardness is read at several points across the sample.",
            "The average hardness is compared with the specified range (for example 40 to 48 HRC for a spring washer)."
        ]]
    },

    {
        match: /compression\s*(load|test|set)|spring\s*(load|force|rate|characteristic)|load\s*at\s*(flat|compression|solid)|free\s*height|flattening|permanent\s*set|load[\s-]?deflection/i,
        standard: "DIN 127 / IS 3063 (Spring load / compression)",
        hazard: "insufficient spring load or excessive permanent set",
        reasonPass: "the spring load at the specified height met the requirement and the permanent set stayed within the limit",
        reasonFail: "the spring load was low or the permanent set exceeded the limit, resulting in {n} rejection",
        procedure: [[
            "The free height of the {n} is measured, then it is placed in a compression testing machine.",
            "It is compressed to the specified test height (or flattened solid) and the load at that height is recorded.",
            "The load is released and the free height is re-measured to determine any permanent set.",
            "The spring load and the permanent set are compared with the specified values."
        ]]
    },

    {
        match: /decarburi[sz]ation|decarb|carburi[sz]ation|surface\s*integrity/i,
        standard: "ISO 898-1 / IS 3063 (Decarburization)",
        hazard: "surface decarburization weakening the part",
        reasonPass: "the decarburized (and any carburized) layer was within the allowed depth",
        reasonFail: "the decarburized layer exceeded the allowed depth, resulting in {n} rejection",
        procedure: [[
            "A cross-section of the {n} is cut, mounted, polished and etched.",
            "Under a calibrated microscope the depth of the fully decarburized and partially decarburized layer is measured at the specified location (for example the thread root).",
            "Any carburized layer is also measured where required.",
            "The measured depths are compared with the maximum allowed by the standard."
        ]]
    },

    {
        match: /plating\s*thickness|coating\s*thickness.*(zinc|metal|plating|electro)|iso\s*1463|astm\s*b499|zinc\s*(coating|plating)|electroplat.*thickness/i,
        standard: "ISO 1463 / ASTM B499 (Coating / plating thickness)",
        hazard: "plating thickness outside the specified value",
        reasonPass: "the measured plating thickness was within the specified range at every point",
        reasonFail: "the plating thickness was outside the specified range, resulting in {n} rejection",
        procedure: [[
            "The plated {n} is cleaned and the coating thickness is measured with a magnetic / eddy-current gauge (or by cross-section microscopy).",
            "Measurements are taken at several points, including the significant surfaces and recesses.",
            "For a reference, the coating may also be measured by the coulometric or cross-section method.",
            "The measured thickness is compared with the specified minimum and range."
        ]]
    },

    {
        match: /hydrogen\s*embrittle|embrittlement|iso\s*15330|astm\s*f1940|sustained[\s-]?load\s*test|delayed\s*fracture/i,
        standard: "ISO 15330 / ASTM F1940 (Hydrogen embrittlement)",
        hazard: "delayed fracture from hydrogen embrittlement after plating",
        reasonPass: "the plated {n} survived the sustained-load test with no cracking or fracture",
        reasonFail: "the {n} cracked or fractured under sustained load, indicating hydrogen embrittlement",
        procedure: [[
            "Plated samples of the {n} are assembled onto the specified test fixture (wedge / hardened washers) and loaded to the specified percentage of the proof / minimum breaking load.",
            "The loaded samples are held under sustained load at room temperature for the specified time (at least 48 hours).",
            "The samples are inspected during and after the hold for any cracking or head/thread fracture.",
            "The {n} passes only if no sample cracks or fractures within the hold time."
        ]]
    },

    {
        // Torque-tension is a static tightening test, not the Junker vibration test.
        match: /torque[\s-]*(\/\s*)?(tension|clamp\s*force)|friction\s*coefficient.{0,20}(bolt|fastener|thread)|iso\s*16047/i,
        standard: "ISO 16047 (Torque / clamp force)",
        hazard: "a bolt that gives too little clamp force at its tightening torque",
        reasonPass: "the clamp force at the specified torque and the friction coefficients were within the specified range",
        reasonFail: "the clamp force or the friction coefficient was outside the specified range, resulting in {n} failure",
        procedure: [[
            "The {n} is fitted in a torque-tension test rig with a load cell under the joint.",
            "The fastener is tightened at a steady speed while torque, clamp force and angle are recorded.",
            "The thread and under-head friction coefficients are calculated from the readings.",
            "The clamp force at the specified torque and the friction coefficients are checked against the specification."
        ]]
    },

    {
        match: /junker|self[\s-]?loosening|vibration\s*loosening|din\s*65151|transverse\s*vibration|prevailing\s*torque|clamp\s*load\s*(retention|loss|test)|locking\s*performance|anti[\s-]?loosening/i,
        standard: "DIN 65151 (Junker) / ISO 16130 (Self-loosening)",
        hazard: "the joint loosening under transverse vibration",
        reasonPass: "the washer/joint retained the required clamp force over the vibration cycles without self-loosening",
        reasonFail: "the clamp force dropped below the limit (self-loosening) during the vibration test, resulting in {n} failure",
        procedure: [[
            "The {n} is assembled with the specified bolt and nut and tightened to the specified preload (clamp force), measured with a load cell, on a Junker (transverse vibration) machine.",
            "Transverse vibration of the specified amplitude and frequency is applied while the clamp force is logged continuously.",
            "The clamp-force retention is recorded against the number of cycles.",
            "The residual clamp force after the specified cycles is compared with the acceptance limit (the joint must not self-loosen below it)."
        ]]
    },

    // ---- Eye protection: safety goggles / spectacles / face shields (EN 166) ----

    {
        match: /optical\s*(quality|power|class)|refractive\s*power|spherical\s*power|astigmat|prismatic|diopt|en\s*167/i,
        standard: "EN 166 / EN 167 (Optical quality)",
        hazard: "optical distortion causing eye strain or misjudged distance",
        reasonPass: "the spherical, astigmatic and prismatic powers were within the limits for the declared optical class",
        reasonFail: "an optical power exceeded the limit for the optical class, resulting in {n} rejection",
        procedure: [[
            "The {n} lens (or ocular) is mounted in the telescope / focimeter test bench at the specified reference point.",
            "The spherical refractive power, astigmatic power and prismatic power (including the difference between the two eyes) are measured.",
            "Any local defects, striae, bubbles or inclusions in the field of vision are examined against the test pattern.",
            "The measured powers are compared with the limits for the declared optical class (Class 1, 2 or 3 per EN 166)."
        ]]
    },

    {
        match: /luminous\s*transmit|transmittance|light\s*transmission|uv\s*filter|uv\s*protection|shade\s*number|filter\s*(class|scale)|en\s*170|en\s*172/i,
        standard: "EN 166 / EN 170 / EN 172 (Luminous transmittance & UV filter)",
        hazard: "insufficient UV filtering or wrong luminous transmittance",
        reasonPass: "the luminous transmittance and UV/IR attenuation matched the declared scale number and filter class",
        reasonFail: "the transmittance or UV attenuation was outside the declared filter class, resulting in {n} rejection",
        procedure: [[
            "The {n} lens is placed in a calibrated spectrophotometer over the specified wavelength range.",
            "The spectral transmittance is measured through the UV (210 to 380 nm), visible (380 to 780 nm) and where required IR range.",
            "The luminous transmittance and the maximum UV transmittance are calculated from the spectral data.",
            "The results are compared with the limits for the declared scale number / filter class (for example 2C-1.2 per EN 170)."
        ]]
    },

    {
        match: /(low|medium|high)\s*energy\s*impact|energy\s*impact|ball\s*impact|6\s*mm\s*ball|22\s*mm\s*ball|robustness|z87|en\s*168.*impact|impact.*(goggle|spectacle|lens|ocular|eye)/i,
        standard: "EN 166 / EN 168 / ANSI Z87.1 (Impact resistance)",
        hazard: "lens or frame failing on impact and injuring the eye",
        reasonPass: "the {n} withstood the impact at the required energy with no lens fracture, deformation or parts detaching",
        reasonFail: "the lens fractured, deformed or parts detached on impact, resulting in {n} rejection",
        procedure: [[
            "The {n} is fitted onto the standard headform and conditioned at the specified temperature.",
            "A 6 mm steel ball is fired at the lens and frame at the speed for the required class - low energy 45 m/s (S/F), medium energy 120 m/s (B), high energy 190 m/s (A); increased robustness uses a 22 mm ball at 5.1 m/s.",
            "The specified impact points are struck and the assembly is observed for lens fracture, deformation, penetration or parts detaching from the headform.",
            "The {n} passes only if the lens does not fracture or detach and nothing contacts the headform eye."
        ]]
    },

    {
        match: /field\s*of\s*(vision|view)|fov\b|peripheral\s*vision/i,
        standard: "EN 166 / EN 168 (Field of vision)",
        hazard: "restricted field of vision",
        reasonPass: "the field of vision met the minimum required area in the ellipse for both eyes",
        reasonFail: "the field of vision was smaller than required, resulting in {n} rejection",
        procedure: [[
            "The {n} is mounted on the standard headform in the normal wearing position.",
            "The field-of-vision apparatus projects the required ellipse for each eye onto the ocular.",
            "The unobstructed area within the ellipse is measured for each eye, checking that no frame part intrudes.",
            "The measured field is compared with the EN 166 minimum requirement for both eyes."
        ]]
    },

    {
        match: /surface\s*damage|fine\s*particle|sand\s*abrasion|scratch\s*resist|\bk\s*marking/i,
        standard: "EN 166 / EN 168 (Resistance to surface damage by fine particles)",
        hazard: "the lens hazing from abrasive particles",
        reasonPass: "the diffusion of light after the abrasion stayed within the specified limit (K marking)",
        reasonFail: "the light diffusion exceeded the limit after abrasion, resulting in {n} rejection",
        procedure: [[
            "The {n} lens is mounted in the fine-particle (sand blast) apparatus.",
            "A specified quantity of graded silica sand is allowed to fall onto the rotating lens from the specified height.",
            "The reduction in luminous transmittance and the increase in light diffusion are measured before and after.",
            "The measured diffusion is compared with the specified limit for the K (surface damage) marking."
        ]]
    },

    {
        match: /fogging|anti[\s-]?fog|misting|\bn\s*marking/i,
        standard: "EN 166 / EN 168 (Resistance to fogging)",
        hazard: "the lens fogging and blocking vision",
        reasonPass: "the ocular stayed clear of fogging for at least the required time (N marking)",
        reasonFail: "the ocular fogged before the required time, resulting in {n} rejection",
        procedure: [[
            "The {n} lens is conditioned at the specified temperature and humidity.",
            "It is held over a water bath at the specified temperature so its inner surface is exposed to saturated vapour.",
            "The time until the luminous transmittance falls below the specified level (fogging) is recorded.",
            "The fog-free time is compared with the minimum required for the N (anti-fog) marking."
        ]]
    },

    {
        match: /splash|droplet|liquid\s*(splash|droplet)|chemical\s*splash|spray\s*resist.*(goggle|eye)/i,
        standard: "EN 166 (Liquid splash / droplet - marking 3)",
        hazard: "liquid splash reaching the eye",
        reasonPass: "no liquid reached the indicator area of the headform inside the {n}",
        reasonFail: "liquid penetrated to the eye area, resulting in {n} rejection",
        procedure: [[
            "The {n} is fitted to the standard headform, which carries a coloured indicator paper over the eye area.",
            "The specified liquid is sprayed (droplets) or thrown (splash) at the headform from the specified distance and volume.",
            "The indicator paper is inspected for any staining that would show liquid reaching the eye area.",
            "The {n} passes only if no liquid reaches the indicator area, for the declared marking (3 = droplets, 3/4 = splash)."
        ]]
    },

    {
        match: /ignition\s*resist|resistance\s*to\s*ignition|hot\s*rod|glowing\s*rod|molten\s*metal|hot\s*solid|spatter/i,
        standard: "EN 166 / EN 168 (Resistance to ignition / molten metal)",
        hazard: "the frame or lens igniting or being penetrated by hot material",
        reasonPass: "the {n} did not ignite or continue to glow, and hot material did not penetrate",
        reasonFail: "the {n} ignited, kept glowing or was penetrated by hot material, resulting in rejection",
        procedure: [[
            "A steel rod is heated to the specified temperature (for example 650 °C) and held against the {n} for 5 seconds.",
            "For molten-metal protection, molten metal is poured onto the {n} fitted on the headform per the specified method.",
            "The {n} is observed for ignition, continued glowing after removal, and for any penetration or adhesion of hot material.",
            "The {n} passes only if it does not ignite or keep glowing and the hot material does not penetrate."
        ]]
    },

    {
        match: /headband|strap\s*strength|frame\s*strength|retention\s*system|temple\s*strength/i,
        standard: "EN 166 / ANSI Z87.1 (Headband / frame strength)",
        hazard: "the headband or frame failing and the eyewear coming off",
        reasonPass: "the headband and frame withstood the specified load without breaking or slipping",
        reasonFail: "the headband or frame broke, tore or slipped under the specified load, resulting in {n} rejection",
        procedure: [[
            "The {n} is fitted to the standard headform with the headband adjusted as in normal wear.",
            "The specified tensile load is applied to the headband / temples with a tensile tester at the specified rate.",
            "The load is held for the specified time while the attachment points, buckles and frame are observed.",
            "The {n} passes if nothing breaks, tears or slips and the eyewear stays correctly positioned."
        ]]
    },

    // ---- Electrical connectors / harness / relays / fuses (IEC 60512 / EIA-364) ----

    {
        match: /contact\s*resistance|termination\s*resistance|\bllcr\b|low[\s-]?level\s*contact\s*resistance|milli?ohm.*(contact|connector|terminal)/i,
        standard: "IEC 60512-2 / EIA-364-06 (Contact resistance)",
        hazard: "high or unstable contact resistance",
        reasonPass: "the contact resistance stayed within the specified limit at every contact",
        reasonFail: "a contact resistance exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The {n} is fully mated and a low test current (for example 100 mA at open-circuit voltage below 20 mV) is passed through each contact pair.",
            "The voltage drop across the mated contact is measured by the four-wire method to exclude the lead resistance.",
            "The contact (or low-level contact) resistance is calculated for each contact.",
            "The measured resistance is compared with the specified maximum (for example below 10 milliohms)."
        ]]
    },

    {
        match: /mating\s*force|un[\s-]?mating\s*force|insertion\s*force|withdrawal\s*force|engage\w*\s*force|coupling\s*force|extraction\s*force/i,
        standard: "IEC 60512-13 / EIA-364-13 (Insertion / withdrawal force)",
        hazard: "insertion or withdrawal force outside the specified range",
        reasonPass: "the mating and un-mating forces were within the specified minimum and maximum",
        reasonFail: "the mating or un-mating force was outside the specified range, resulting in {n} rejection",
        procedure: [[
            "The two halves of the {n} are held in the fixtures of a tensile / compression tester aligned to the mating axis.",
            "They are mated at the specified constant rate and the maximum insertion force is recorded.",
            "They are then un-mated at the same rate and the maximum withdrawal (extraction) force is recorded.",
            "The insertion and withdrawal forces are compared with the specified minimum and maximum."
        ]]
    },

    {
        match: /crimp\s*(pull|tensile|strength|test|quality|height)|conductor\s*pull[\s-]?out|terminal\s*pull|wire\s*pull[\s-]?out|pull[\s-]?off\s*force/i,
        standard: "IEC 60352-2 / EIA-364-08 / USCAR-21 (Crimp pull-out)",
        hazard: "the wire pulling out of the crimped terminal",
        reasonPass: "the crimp held the wire above the specified minimum pull-out force",
        reasonFail: "the wire pulled out below the specified force, resulting in {n} rejection",
        procedure: [[
            "A terminal is crimped onto the specified wire gauge with the production tool and settings, and a cross-section confirms the crimp.",
            "The terminal is clamped in a tensile tester and the wire is pulled along its axis at the specified rate.",
            "The pull is continued until the wire pulls out of the crimp or breaks, and the peak force is recorded.",
            "The pull-out force is compared with the specified minimum for that wire size."
        ]]
    },

    {
        match: /current[\s-]?carrying|current\s*rating|derating\s*curve|ampacity|temperature\s*rise.*(connector|contact|terminal|pin)|(connector|contact|terminal).*temperature\s*rise|t[\s-]?rise/i,
        standard: "IEC 60512-5 / EIA-364-70 (Current rating / temperature rise)",
        hazard: "overheating of the contacts at the rated current",
        reasonPass: "the contact temperature rise stayed within the specified limit at the rated current",
        reasonFail: "the temperature rise exceeded the limit, resulting in a lower current rating for {n}",
        procedure: [[
            "The {n} is mated and every contact is loaded to the specified current (single-contact or fully-loaded pattern) with representative wire.",
            "It is run until the contact temperatures reach thermal equilibrium in the specified ambient.",
            "The temperature rise above ambient at the hottest contact is measured with a thermocouple.",
            "The temperature rise is compared with the limit (for example 30 K), and the derating curve is established."
        ]]
    },

    {
        match: /mating\s*cycle|un[\s-]?mating\s*cycle|insertion\s*cycle|mechanical\s*durability|connector\s*durability|reseating|mate[\s-]?un[\s-]?mate/i,
        standard: "IEC 60512-9 / EIA-364-09 (Mechanical durability)",
        hazard: "contact wear and resistance rise after repeated mating",
        reasonPass: "after the required mating cycles the contact resistance stayed within limit with no harmful wear",
        reasonFail: "the contact resistance rose beyond limit or the contacts wore out after cycling, resulting in {n} failure",
        procedure: [[
            "The initial contact resistance of the {n} is measured.",
            "The connector is mated and un-mated for the specified number of cycles (for example 50 to 500) at the specified rate.",
            "The contact resistance is re-measured at intervals and the contacts and housing are inspected for wear.",
            "The final contact resistance and the wear are compared with the acceptance limits."
        ]]
    },

    // ---- Gearbox / mechanical transmission tests ----
    // These sit before the motor block so a gear test is not read as a motor test
    // (gearbox efficiency, gear temperature rise, torque ripple, etc. use ISO gear standards).

    {
        match: /gear\w*.{0,15}efficien|efficien.{0,15}gear|transmission\s*efficien/i,
        standard: "ISO 14179 (Gear thermal / power loss) / product specification",
        hazard: "gearbox efficiency below the specified target",
        reasonPass: "the measured gearbox efficiency met or exceeded the specified target across the torque range",
        reasonFail: "the gearbox efficiency was below the specified target, resulting in {n} rejection",
        procedure: [[
            "The gearbox is coupled between a drive dynamometer (input) and an absorbing dynamometer (output), with a torque transducer on each shaft.",
            "It is run at the specified input speed while the output torque is set to each test level (for example 25%, 50%, 75% and 100% of rated) and the temperatures are allowed to stabilise.",
            "At each level the input torque and speed and the output torque and speed are recorded.",
            "The efficiency is calculated as (output torque x output speed) / (input torque x input speed) at each torque level and compared with the specification."
        ]]
    },

    {
        match: /gear.{0,15}temperature\s*rise|gear.{0,15}temp\s*rise|temperature\s*rise.{0,15}gear|gearbox\s*temp|lubricant\s*temp|oil\s*sump\s*temp/i,
        standard: "ISO 14179 (Gear thermal rating) / product specification",
        hazard: "gearbox overheating under rated torque",
        reasonPass: "the gear housing, lubricant and bearing temperature rise stayed within the specified limits",
        reasonFail: "the gearbox temperature rise exceeded the specified limit, resulting in {n} failure",
        procedure: [[
            "The gearbox is run at rated input speed with rated output torque applied by the load dynamometer.",
            "It is run continuously until thermal equilibrium is reached.",
            "The gear-housing, lubricant (oil sump) and bearing temperatures are recorded with thermocouples.",
            "The steady-state temperature rise above ambient is calculated at each point and compared with the specification."
        ]]
    },

    {
        match: /torque\s*ripple|torque\s*fluctuat|torque\s*smooth|output\s*torque\s*variation/i,
        standard: "ISO 8579-2 (Transmission vibration) / product specification",
        hazard: "excessive torque ripple / output torque fluctuation",
        reasonPass: "the measured torque ripple was within the specified limit",
        reasonFail: "the torque ripple exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The motor and gearbox are coupled to a torque transducer on the output shaft.",
            "The assembly is run at constant speed under each specified load.",
            "The instantaneous output torque is recorded at a high sample rate over several revolutions.",
            "The torque ripple is calculated as (maximum torque − minimum torque) / mean torque (%) and compared with the specification."
        ]]
    },

    {
        match: /variable\s*frequency|\bvfd\b|frequency\s*sweep|inverter\s*drive.*gear|drive.*gear.*load|gear.*(vfd|drive)\s*load/i,
        standard: "IEC 61800-2 / ISO 8579 (Drive-system load test)",
        hazard: "unstable operation across the drive speed range",
        reasonPass: "the gearbox ran stably across the full speed range with vibration, torque and temperature within limits",
        reasonFail: "the gearbox showed resonance, overheating or abnormal vibration during the sweep, resulting in {n} failure",
        procedure: [[
            "The gearbox is driven by the motor through a variable frequency drive (VFD) and loaded by an absorbing dynamometer.",
            "The drive frequency (motor speed) is swept across the operating range in steps while the specified load is applied.",
            "At each speed the gearbox vibration, output torque, bearing/lubricant temperature and noise are recorded.",
            "Stable operation across the range is verified, with no resonance, overheating or abnormal vibration beyond the limits."
        ]]
    },

    {
        match: /gear\s*ratio|power\s*consumption.{0,15}gear|gear.{0,15}(power\s*consumption|ratio)/i,
        standard: "Product specification (Gear-ratio power consumption)",
        hazard: "poor efficiency or high power consumption at a given gear ratio",
        reasonPass: "the power consumption and efficiency of each gear ratio met the specified targets",
        reasonFail: "a gear ratio consumed more power than specified, resulting in {n} rejection",
        procedure: [[
            "The motor is fitted with each specified gear ratio in turn and coupled to the same load.",
            "An identical, defined load and duty cycle are applied for every gear ratio.",
            "The electrical input power (voltage, current and power) and the output speed and torque are measured for each ratio.",
            "The efficiency and power consumption of each gear ratio are calculated and compared to select or verify the ratio."
        ]]
    },

    {
        match: /backlash|lash\b|angular\s*play|gear\s*play|lost\s*motion/i,
        standard: "ISO 1328 / product specification (Backlash)",
        hazard: "gear backlash outside the specified range",
        reasonPass: "the measured backlash was within the specified minimum and maximum",
        reasonFail: "the backlash was outside the specified range, resulting in {n} rejection",
        procedure: [[
            "The gearbox input shaft is held fixed while a dial indicator (or encoder) is set against the output shaft.",
            "The output shaft is rotated gently in each direction up to the point of tooth contact, without loading the teeth.",
            "The angular (or linear at the pitch line) lost motion between the two contact points is read as the backlash.",
            "The measurement is repeated at several angular positions and compared with the specified backlash range."
        ]]
    },

    // ---- Power-electronics / charger / controller tests ----
    // These sit before the motor block so a converter/charger test is not read as a motor test
    // (for example "Power Conversion Efficiency" must not match the motor efficiency test).

    {
        // Keep temperature-cycling names off the motor endurance/life template further down.
        match: /temperature\s*cycl|thermal\s*cycl|temp\s*cycl/i,
        standard: "IEC 60068-2-14 (Test Nb, temperature change) / IEC 60068-2-1 & -2-2",
        hazard: "repeated slow heating and cooling",
        reasonPass: "the sample completed all temperature cycles without cracking, leakage or loss of function",
        reasonFail: "the sample cracked, leaked or stopped working during the temperature cycles, resulting in {n} failure",
        procedure: [[
            "The {n} is placed in a temperature chamber and stabilised at room temperature.",
            "The temperature is ramped slowly (about 1 to 3 °C per minute) to the low limit, for example −40 °C, and held for a 1 to 2 hour dwell.",
            "The temperature is then ramped up at the same rate to the high limit, for example +85 °C, and held for the same dwell time.",
            "This low-to-high cycle is repeated for the specified number of cycles (typically 5 to 10), and afterwards the {n} is checked for function, cracks and leakage."
        ]]
    },

    {
        match: /power\s*conversion|conversion\s*efficien|converter\s*efficien|charg\w*\s*efficien|dc[\s-]*dc\s*efficien|inverter\s*efficien|rectifier\s*efficien/i,
        standard: "IEC 62477-1 / IEC 61204-3 (Conversion efficiency)",
        hazard: "conversion efficiency below the specified target",
        reasonPass: "the measured conversion efficiency met or exceeded the specified target across the load range",
        reasonFail: "the conversion efficiency was below the specified target, resulting in {n} rejection",
        procedure: [[
            "The {n} is supplied at nominal input and connected to a programmable electronic load.",
            "The input power and output power are measured simultaneously with a calibrated power analyser at each load point (for example 10%, 25%, 50%, 75% and 100%).",
            "The efficiency is calculated as output power divided by input power at each load point.",
            "The peak efficiency and the weighted-average efficiency are compared with the specified targets."
        ]]
    },

    {
        match: /input\s*voltage\s*range|operating\s*voltage\s*range|supply\s*voltage\s*range|voltage\s*range\s*verif|wide\s*input\s*voltage|input\s*range|operating\s*supply\s*range/i,
        standard: "IEC 61204-3 / product specification (Input / supply voltage range)",
        hazard: "operation outside the specified input voltage range",
        reasonPass: "the {n} operated within specification across the full input range and shut down safely beyond it",
        reasonFail: "the {n} failed to regulate or was damaged within the specified input range, resulting in failure",
        procedure: [[
            "The {n} is connected to a programmable source at its input and loaded at rated output.",
            "The input voltage is varied in steps from the minimum to the maximum of the specified operating range.",
            "At each input voltage the output voltage and current, regulation and correct operation are recorded.",
            "The {n} must stay within specification across the range and shut down safely (without damage) outside it."
        ]]
    },

    {
        match: /output\s*voltage\s*regul|voltage\s*regul|load\s*regul|line\s*regul/i,
        standard: "IEC 61204-3 (Output regulation)",
        hazard: "output voltage drift beyond the regulation limit",
        reasonPass: "the line and load regulation stayed within the specified limits",
        reasonFail: "the output regulation exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The {n} is supplied at nominal input and connected to an electronic load.",
            "Line regulation: the input is varied across its range at a fixed load and the output deviation is recorded.",
            "Load regulation: the load is varied from no-load to full-load at fixed input and the output deviation is recorded.",
            "The measured regulation (as a percentage of nominal output) is compared with the specified limit."
        ]]
    },

    {
        match: /continuous\s*current|current\s*limit|maximum\s*current|rated\s*output\s*current|foldback/i,
        standard: "IEC 62477-1 / product specification (Current limit)",
        hazard: "output current beyond the safe continuous rating",
        reasonPass: "the {n} sustained the rated continuous current and limited correctly above it without overheating",
        reasonFail: "the {n} overheated or failed to limit the output current, resulting in failure",
        procedure: [[
            "The {n} is run at rated input and its output current is increased gradually with an electronic load.",
            "The current is held at the rated maximum continuous value while the temperatures stabilise.",
            "The output current at which the {n} enters current-limit or foldback is recorded.",
            "The {n} must sustain the rated current without overheating and limit correctly above it."
        ]]
    },

    {
        match: /fault\s*current|fault\s*detection|trip\s*test|overcurrent\s*(detect|trip)|protection\s*trip/i,
        standard: "IEC 62477-1 (Protective functions)",
        hazard: "failure of the fault-current protection to trip",
        reasonPass: "the protection detected the fault and tripped within the specified threshold and time",
        reasonFail: "the protection failed to trip or tripped outside the specified limits, resulting in {n} failure",
        procedure: [[
            "The {n} is run at rated output and a controlled fault (overcurrent or output short) is applied through a fast switch.",
            "The output current and the time for the protection to detect the fault and trip are captured with an oscilloscope.",
            "The trip threshold and trip time are compared with the specified protection settings.",
            "After the fault is removed, the correct auto-recovery or latched behaviour of the {n} is verified."
        ]]
    },

    {
        match: /inrush|in-rush|switch[\s-]*on\s*current|turn[\s-]*on\s*current/i,
        standard: "IEC 62477-1 / IEC 61000-3 (Inrush current)",
        hazard: "excessive inrush current at switch-on",
        reasonPass: "the peak inrush current stayed within the specified limit and the input protection did not nuisance-trip",
        reasonFail: "the inrush current exceeded the limit or tripped the input protection, resulting in {n} rejection",
        procedure: [[
            "The {n} is connected through a current probe and switched on at the worst-case input voltage (the peak of the AC cycle) with cold components.",
            "The peak inrush current and its duration are captured with a storage oscilloscope.",
            "The test is repeated for several switch-on phase angles and after the specified off-time.",
            "The peak inrush is compared with the specified limit and the rating of the input fuse or protection."
        ]]
    },

    {
        match: /power\s*factor|\bpfc\b|harmonic\s*current|current\s*harmonic/i,
        standard: "IEC 61000-3-2 / IEC 61000-3-12 (Power factor & harmonics)",
        hazard: "low power factor or excessive input current harmonics",
        reasonPass: "the power factor and input current harmonics were within the specified limits across the load range",
        reasonFail: "the power factor or harmonics exceeded the specified limits, resulting in {n} rejection",
        procedure: [[
            "The {n} is supplied at nominal AC input and loaded from no-load to full-load in steps.",
            "A power analyser measures the true power factor, the displacement factor and the input current harmonics at each load.",
            "The results are recorded across the full load range.",
            "The power factor and harmonic currents are compared with the specified limits (for example PF ≥ 0.95 at full load)."
        ]]
    },

    {
        match: /reverse\s*power|reverse\s*current|back[\s-]*feed|reverse\s*polarity|anti[\s-]*island/i,
        standard: "IEC 62477-1 / product specification (Reverse power / back-feed)",
        hazard: "unwanted reverse power flow or back-feed",
        reasonPass: "the {n} blocked reverse current and did not feed power back to the source",
        reasonFail: "the {n} allowed reverse power flow or was damaged, resulting in failure",
        procedure: [[
            "The {n} is set up in its normal configuration with the source and load connected.",
            "Conditions that could cause reverse power flow are applied (for example a higher voltage on the output side, or removal of the source).",
            "The {n} is monitored to confirm it blocks reverse current and does not feed power back to the source.",
            "The reverse-current blocking and any protection response are verified against the requirement."
        ]]
    },

    {
        match: /minimum\s*(external\s*)?power|startup\s*power|start[\s-]*up\s*power|minimum\s*input|turn[\s-]*on\s*threshold|cold\s*start/i,
        standard: "product specification (Start-up threshold)",
        hazard: "the unit failing to start at the minimum input level",
        reasonPass: "the {n} started reliably at or below the specified minimum input level and delivered a stable output",
        reasonFail: "the {n} required more than the specified minimum input to start, resulting in rejection",
        procedure: [[
            "The {n} is connected to a variable input source and a nominal load.",
            "The input power or voltage is raised slowly from zero until the {n} starts up and delivers a stable output.",
            "The minimum input level required for reliable start-up is recorded.",
            "The value is compared with the specified maximum allowed start-up threshold."
        ]]
    },

    {
        match: /energy\s*consumption|standby\s*power|no[\s-]*load\s*power|quiescent|vampire\s*power|charge\s*protocol/i,
        standard: "IEC 62301 (Standby / no-load power) / product specification",
        hazard: "excessive standby power or energy consumption",
        reasonPass: "the standby power and the energy consumed over the charge protocol were within the specified limits",
        reasonFail: "the standby power or energy consumption exceeded the specified limits, resulting in {n} rejection",
        procedure: [[
            "The {n} is connected at nominal input with the output either open (no-load / standby) or following the specified charge protocol.",
            "The input energy is integrated with a power / energy meter over the defined period or the full charge cycle.",
            "The standby power and the total energy consumed during the charge protocol are recorded.",
            "The values are compared with the specified efficiency and standby-power limits."
        ]]
    },

    {
        match: /charging\s*time|charge\s*time|charge\s*profile|charge\s*curve|state[\s-]*of[\s-]*charge\s*curve|soc\s*curve|cc[\s-]*cv/i,
        standard: "IEC 61851 / product specification (Charging profile)",
        hazard: "charging profile outside the specified curve",
        reasonPass: "the charging-time-versus-state-of-charge curve matched the specified charging profile",
        reasonFail: "the charging profile deviated from the specification, resulting in {n} rejection",
        procedure: [[
            "A reference battery (or a battery emulator) at a known low state of charge is connected to the {n}.",
            "The {n} runs its normal charging protocol (for example CC-CV) while the voltage, current and state of charge are logged.",
            "The charging time to reach each state of charge (for example 50%, 80% and 100%) is recorded.",
            "The charging-time-versus-state-of-charge curve is compared with the specified charging profile."
        ]]
    },

    {
        match: /heat\s*dissipation|self[\s-]*heating|thermal\s*rise\s*under|thermal\s*perform/i,
        standard: "IEC 62477-1 / IEC 60068-2-2 (Thermal performance)",
        hazard: "overheating of internal components under load",
        reasonPass: "every component temperature stayed within its rated maximum with the required derating margin",
        reasonFail: "a component exceeded its rated temperature under load, resulting in {n} failure",
        procedure: [[
            "The {n} is mounted as in service and run at rated output (or continuous charging) in the specified ambient until temperatures stabilise.",
            "Thermocouples on the hottest components (semiconductors, magnetics, capacitors and heat sink) record the steady-state temperatures.",
            "The temperature rise above ambient at each point is calculated.",
            "Each component temperature is compared with its rated maximum and the derating requirement."
        ]]
    },

    {
        match: /maximum\s*operating\s*temp|max\s*operating\s*temp|operating\s*temperature\s*limit|upper\s*temperature\s*limit/i,
        standard: "IEC 60068-2-2 (Dry heat) / product specification",
        hazard: "operation above the maximum rated temperature",
        reasonPass: "the {n} met specification up to its rated maximum operating temperature and shut down safely above it",
        reasonFail: "the {n} failed below its rated maximum operating temperature, resulting in failure",
        procedure: [[
            "The {n} is placed in a thermal chamber and run at rated load.",
            "The ambient temperature is raised in steps up to and beyond the specified maximum operating temperature.",
            "At each step the operation, output and internal temperatures of the {n} are monitored.",
            "The highest ambient at which the {n} still meets specification (and its safe shutdown above it) is recorded and compared with the rating."
        ]]
    },

    // ---- Motor performance tests (must sit before the broad regexes below) ----

    {
        // No-load must come before the load/torque test ("no-load current" contains "load current").
        match: /no[\s-]*load/i,
        standard: "IEC 60034-2-1 (No-load test)",
        hazard: "abnormal no-load current or losses",
        reasonPass: "the no-load current and losses were within the specified limits",
        reasonFail: "the no-load current or losses exceeded the specified limits, resulting in {n} rejection",
        procedure: [[
            "The {n} is run uncoupled (no mechanical load) at rated voltage and frequency until the bearings and windings reach a steady temperature.",
            "The no-load current, no-load input power, voltage and speed are recorded.",
            "Where a saturation curve is needed, the voltage is varied in steps to separate the iron loss from the friction and windage loss.",
            "The no-load current and losses are compared with the specified limits."
        ]]
    },

    {
        match: /performance\s*curve|speed[\s-]*torque|torque[\s-]*speed|characteristic\s*curve|load\s*curve/i,
        standard: "IEC 60034-1 / IEC 60034-2-1 (Performance characteristics)",
        hazard: "performance outside the rated characteristic",
        reasonPass: "the measured speed, torque, current and power followed the specified performance curve",
        reasonFail: "the performance deviated from the specified curve, resulting in {n} rejection",
        procedure: [[
            "The {n} is coupled to a calibrated dynamometer and supplied at rated voltage and frequency.",
            "The load is increased in steps from no-load to beyond rated torque, letting the readings settle at each step.",
            "At each step the speed, torque, input voltage, line current, input power and output power are recorded.",
            "The speed-torque, current-torque and efficiency curves are plotted and compared with the specified performance."
        ]]
    },

    {
        match: /efficien/i,
        standard: "IEC 60034-2-1 (Efficiency determination)",
        hazard: "efficiency below the declared class",
        reasonPass: "the measured efficiency met or exceeded the declared efficiency class",
        reasonFail: "the measured efficiency was below the declared class, resulting in {n} rejection",
        procedure: [[
            "The {n} is coupled to a dynamometer and run at rated voltage, frequency and load until the temperature stabilises.",
            "The input power is measured electrically (voltage, current, power factor) and the output power from the measured torque and speed.",
            "The separate losses (stator and rotor I²R, iron, friction and windage, and stray load loss) are determined as per the standard.",
            "The efficiency is calculated as output power divided by input power and compared with the declared class (for example IE2 / IE3 / IE4)."
        ]]
    },

    {
        match: /load\s*current|load\s*torque|torque\s*test|starting\s*torque|locked\s*rotor\s*torque|rated\s*torque/i,
        standard: "IEC 60034-1 (Load / torque test)",
        hazard: "load current or torque outside the rated values",
        reasonPass: "the rated-load current and torque were within the specified limits",
        reasonFail: "the load current or torque was outside the specified limits, resulting in {n} rejection",
        procedure: [[
            "The {n} is coupled to a dynamometer or brake and supplied at rated voltage and frequency.",
            "The load is applied in steps up to and beyond rated torque; for locked-rotor the shaft is held stationary and a reduced voltage is applied briefly.",
            "At each step the torque, speed, line current and input power are measured and recorded.",
            "The full-load current and torque (and, where required, the locked-rotor torque and current) are compared with the specification."
        ]]
    },

    {
        match: /back[\s-]*emf|bemf|back\s*electromotive|voltage\s*constant|\bke\b/i,
        standard: "IEC 60034-1 / product specification (Back-EMF / voltage constant)",
        hazard: "back-EMF or voltage constant outside tolerance",
        reasonPass: "the measured back-EMF waveform and voltage constant were within the specified tolerance",
        reasonFail: "the back-EMF or voltage constant was outside tolerance, resulting in {n} rejection",
        procedure: [[
            "The {n} is driven as a generator at a controlled, known speed by an external prime mover, with the windings open-circuit.",
            "The line-to-line back-EMF voltage is measured with an oscilloscope at several speeds.",
            "The voltage constant (Ke, V per krpm) is calculated and the waveform shape (sinusoidal / trapezoidal) and harmonics are examined.",
            "The voltage constant and waveform are compared with the specified values and tolerance."
        ]]
    },

    {
        match: /cogging\s*torque|detent\s*torque|torque\s*ripple\s*.*motor/i,
        standard: "Product specification (Cogging torque)",
        hazard: "excessive cogging (detent) torque",
        reasonPass: "the measured cogging torque was within the specified limit",
        reasonFail: "the cogging torque exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The {n} is de-energised and its shaft is coupled to a low-inertia torque transducer.",
            "The shaft is rotated very slowly through one or more revolutions while the windings remain open.",
            "The torque required to turn the shaft is recorded continuously against the shaft angle.",
            "The peak-to-peak cogging torque is calculated and compared with the specified limit."
        ]]
    },

    {
        match: /winding\s*resistance|dc\s*resistance|phase\s*resistance|coil\s*resistance/i,
        standard: "IEC 60034-1 (Winding resistance)",
        hazard: "winding resistance outside tolerance or phase imbalance",
        reasonPass: "the phase resistances were within tolerance and balanced across the phases",
        reasonFail: "a phase resistance was out of tolerance or unbalanced, resulting in {n} rejection",
        procedure: [[
            "The {n} is at a known, stabilised ambient temperature and de-energised.",
            "The DC resistance of each phase winding is measured with a calibrated micro-ohmmeter (four-wire method).",
            "The readings are corrected to the reference temperature (for example 20 °C).",
            "The corrected phase resistances and the phase-to-phase imbalance are compared with the specification."
        ]]
    },

    {
        match: /overspeed|over[\s-]*speed|maximum\s*speed\s*test|burst\s*speed/i,
        standard: "IEC 60034-1 (Overspeed test)",
        hazard: "mechanical failure at overspeed",
        reasonPass: "the rotor withstood the overspeed for the specified time with no mechanical damage",
        reasonFail: "the rotor was damaged or deformed at overspeed, resulting in {n} failure",
        procedure: [[
            "The {n} is run up to the specified overspeed (typically 120% of maximum rated speed) under controlled conditions.",
            "The overspeed is maintained for the specified time (for example 2 minutes).",
            "The speed, vibration and any abnormal noise are monitored throughout.",
            "After the test the rotor, magnets and bearings are inspected for cracks, deformation or displacement."
        ]]
    },

    {
        match: /direction\s*of\s*rotation|rotation\s*direction|phase\s*sequence|rotational\s*direction/i,
        standard: "IEC 60034-1 / product specification (Direction of rotation)",
        hazard: "wrong direction of rotation for the given phase sequence",
        reasonPass: "the {n} rotated in the specified direction for the given phase sequence / command",
        reasonFail: "the {n} rotated in the wrong direction, resulting in rejection",
        procedure: [[
            "The {n} is connected with the specified phase sequence (or the controller is given the forward command).",
            "It is energised at reduced voltage and the shaft rotation direction is observed against the reference marking.",
            "The direction is checked for both the forward and the reverse command (or reversed phase sequence).",
            "The observed direction is compared with the specification for each command."
        ]]
    },

    {
        match: /speed\s*regul|speed\s*accuracy|speed\s*control\s*test|rpm\s*accuracy|speed\s*stability/i,
        standard: "IEC 60034-1 / product specification (Speed regulation)",
        hazard: "speed varying beyond the regulation limit with load",
        reasonPass: "the speed stayed within the specified regulation as the load changed",
        reasonFail: "the speed varied beyond the specified regulation, resulting in {n} rejection",
        procedure: [[
            "The {n} is run at a commanded set speed at nominal supply.",
            "The load is varied in steps from no-load to full-load while the actual speed is recorded at each step.",
            "The supply voltage is also varied across its range at fixed load and the speed deviation is recorded.",
            "The speed regulation (percentage change) is calculated and compared with the specified limit."
        ]]
    },

    {
        match: /bearing\s*(test|life|temperature|noise|wear|performance|endurance|inspection)/i,
        standard: "ISO 281 / IEC 60034-1 (Bearing performance)",
        hazard: "bearing overheating, noise or premature wear",
        reasonPass: "the bearing temperature, noise and vibration stayed within limits over the run",
        reasonFail: "the bearing overheated, was noisy or wore beyond the limit, resulting in {n} failure",
        procedure: [[
            "The {n} is run at rated speed and load with thermocouples and a vibration/acoustic sensor at the bearing housings.",
            "The bearing temperature, vibration and noise are recorded at set intervals over the specified run time.",
            "For a life assessment the run is extended for the required hours or the L10 life is evaluated per ISO 281.",
            "The bearing temperature rise, vibration and any wear on strip-down are compared with the limits."
        ]]
    },

    {
        match: /rotor\s*balanc|dynamic\s*balanc|balancing\s*test|unbalance\b|residual\s*unbalance/i,
        standard: "ISO 21940 (Rotor balancing)",
        hazard: "residual rotor unbalance causing vibration",
        reasonPass: "the residual unbalance was within the specified balance grade in both planes",
        reasonFail: "the residual unbalance exceeded the specified balance grade, resulting in {n} rejection",
        procedure: [[
            "The {n} rotor is mounted on a calibrated balancing machine.",
            "It is spun at the balancing speed and the amount and angle of unbalance are measured in each correction plane.",
            "Correction (material removal or addition) is applied and the rotor is re-measured until it is within tolerance.",
            "The residual unbalance is compared with the specified balance quality grade (for example ISO 21940 G2.5)."
        ]]
    },

    {
        // Voltage drop must come before the broad drop/impact template so it is not read as a mechanical drop.
        match: /voltage\s*drop|start[\s-]*up\s*voltage|starting\s*voltage|volt(age)?\s*sag/i,
        standard: "IEC 60034-1 / product specification (Voltage drop)",
        hazard: "excessive voltage drop at start-up or under load",
        reasonPass: "the terminal voltage drop stayed within the allowable limit at start-up and under load",
        reasonFail: "the voltage drop exceeded the allowable limit, resulting in {n} failure",
        procedure: [[
            "The {n} is connected to its rated supply through the controller and instrumented to measure terminal voltage and current.",
            "The terminal voltage is recorded at no-load, then during start-up in-rush and under rated load as the current rises.",
            "The voltage drop between the no-load and the loaded / start-up conditions is calculated at the motor terminals.",
            "The measured drop is compared with the allowable limit in the product specification."
        ]]
    },

    {
        match: /surge|over[\s-]*voltage|voltage\s*spike|load\s*dump|transient\s*voltage/i,
        standard: "IEC 60060-1 / ISO 7637-2 (Surge / over-voltage)",
        hazard: "high-energy voltage surges and transients",
        reasonPass: "the sample withstood the specified surges without insulation damage or malfunction",
        reasonFail: "the sample suffered insulation breakdown or malfunction under the surge, resulting in {n} failure",
        procedure: [[
            "The {n} is connected to the surge generator at its supply terminals, set up as used in service.",
            "Surge pulses of the specified peak voltage, waveform and energy (for example a 1.2/50 µs impulse, or ISO 7637 load-dump pulses) are applied.",
            "The specified number of positive and negative surges is applied at the required repetition rate while the {n} operates.",
            "After the test the {n} is checked for insulation damage and correct function, and the result is graded against the acceptance class."
        ]]
    },

    {
        // Dielectric / Hi-Pot withstand - distinct from the insulation-resistance (Megger) test below.
        match: /dielectric|hi[\s-]*pot|withstand\s*voltage|high\s*voltage\s*withstand|breakdown\s*voltage|flash\s*test/i,
        standard: "IEC 60664 / IEC 60034-1 / ISO 6469-1 (Dielectric / high-voltage withstand)",
        hazard: "insulation breakdown under high voltage",
        reasonPass: "the insulation withstood the applied high voltage for the full duration with no flashover or breakdown",
        reasonFail: "the insulation broke down or flashed over during the test, resulting in {n} failure",
        procedure: [[
            "The {n} is de-energised and its live parts (the supply / output or winding leads as applicable) are connected together; the frame or enclosure forms the other test point.",
            "A high test voltage (typically 1000 V plus twice the rated voltage) is applied between the live parts and the frame or enclosure.",
            "The voltage is raised gradually and held for 1 minute (or for 1 second at 120% of the value for a routine test).",
            "The {n} passes if there is no flashover or breakdown and the leakage current stays within the specified limit."
        ]]
    },

    {
        match: /humid|damp\s*heat|moisture|condensation/i,
        standard: "IEC 60068-2-30 / IEC 60068-2-38 (Damp heat, cyclic)",
        hazard: "moisture ingress and condensation over repeated humidity cycles",
        reasonPass: "the sample withstood the humidity cycles with no corrosion, insulation loss or malfunction",
        reasonFail: "the sample showed corrosion, insulation loss or malfunction after the humidity cycles, resulting in {n} failure",
        procedure: [[
            "The {n} is placed in a climatic chamber and the temperature and humidity are set to the start of the cycle (for example 25 °C at 95% RH).",
            "Each 24-hour cycle raises the temperature to the upper limit (for example +55 °C) at high humidity, holds it, then cools back down so condensation forms on the sample.",
            "The specified number of cycles (typically 6 to 21) is run continuously.",
            "After the cycles the {n} is checked for insulation resistance, corrosion, condensation ingress and correct function."
        ]]
    },

    // ---- Motor / electrical machine tests ----

    {
        match: /immunity|interference\s*immun|susceptib|esd\b|electrostatic/i,
        standard: "ISO 11452 / ISO 7637 / IEC 61000-4 (EMC immunity / susceptibility)",
        hazard: "external electromagnetic interference",
        reasonPass: "the sample kept operating correctly at the specified interference levels (performance Class A/B)",
        reasonFail: "the sample malfunctioned or reset under the interference, resulting in {n} failure",
        procedure: [[
            "The {n} is set up and run in its normal operating condition inside the test setup.",
            "It is subjected to the specified electromagnetic disturbances - radiated RF fields, conducted transients (ISO 7637 pulses) and electrostatic discharge - at the required test levels.",
            "Each disturbance is applied for the specified duration while the {n} is monitored for any malfunction.",
            "The performance is graded (Class A to D) and compared with the required acceptance class."
        ]]
    },

    {
        match: /electromagnetic\s*compat|\bemc\b|emission/i,
        standard: "CISPR 25 / IEC 61000-6-4 (Conducted & radiated emissions)",
        hazard: "electromagnetic emissions from the product",
        reasonPass: "the measured conducted and radiated emissions stayed below the specified limit lines",
        reasonFail: "the emissions exceeded the specified limits, resulting in {n} failure",
        procedure: [[
            "The {n} is placed on the bench in a shielded (semi-anechoic) chamber and run in its normal operating mode.",
            "The conducted emissions on the supply lines are measured over the specified frequency range using a LISN and a measuring receiver.",
            "The radiated emissions are measured with an antenna at the specified distance over the required frequency range.",
            "The measured levels are compared with the CISPR 25 limit class required for the product."
        ]]
    },

    {
        match: /\bnoise\b|acoustic|sound\s*(level|pressure)/i,
        standard: "ISO 3744 / IEC 60034-9 (Noise)",
        hazard: "excessive operating noise",
        reasonPass: "the measured sound level was within the specified limit",
        reasonFail: "the measured noise exceeded the specified limit, resulting in {n} rejection",
        procedure: [[
            "The {n} is run at its rated speed and load in a low-noise (semi-anechoic) environment.",
            "A calibrated sound level meter is placed at the specified distance and positions around the {n}.",
            "The A-weighted sound pressure level is measured at each position while the {n} runs steadily.",
            "The average sound level is calculated and compared with the specified noise limit."
        ]]
    },

    {
        match: /magnetic\s*flux|flux\s*density|gauss|tesla/i,
        standard: "IEC 60404 (Magnetic measurement)",
        hazard: "incorrect magnetic flux density",
        reasonPass: "the measured magnetic flux density was within the specified tolerance",
        reasonFail: "the flux density was outside the specified tolerance, resulting in {n} rejection",
        procedure: [[
            "The {n} is de-energised and mounted in the measurement fixture.",
            "A calibrated gaussmeter or teslameter probe is positioned at the defined measurement points (for example the air gap or magnet surface).",
            "The magnetic flux density is read at each point under the specified conditions.",
            "The measured values are compared with the specified flux density and tolerance."
        ]]
    },

    {
        match: /heat\s*sink|thermal\s*dissipation|temperature\s*rise|temp\s*rise/i,
        standard: "IEC 60034-1 (Temperature rise)",
        hazard: "overheating due to poor heat dissipation",
        reasonPass: "the temperature rise of the windings and heat sink stayed within the limit for the thermal class",
        reasonFail: "the temperature rise exceeded the specified limit, resulting in {n} failure",
        procedure: [[
            "The {n} is run continuously at its rated load and voltage until the temperature stabilises.",
            "The winding temperature (by the resistance method) and the heat-sink/case temperature are recorded with thermocouples.",
            "The steady-state temperature rise above ambient is calculated at each point.",
            "The temperature rise is compared with the limit for the insulation / thermal class of the {n}."
        ]]
    },

    {
        match: /thermal\s*overload|automatic\s*shut|thermal\s*protect|thermal\s*cut/i,
        standard: "IEC 60034-11 / IEC 60730 (Thermal protection)",
        hazard: "failure of the thermal cut-off to operate",
        reasonPass: "the thermal protection tripped and cut off the supply before the safe temperature limit was exceeded",
        reasonFail: "the thermal protection did not operate and the temperature exceeded the safe limit, resulting in {n} failure",
        procedure: [[
            "The {n} is run under an overload or locked-rotor condition so that its temperature rises.",
            "The winding temperature is monitored as the overload forces the temperature up.",
            "The point at which the thermal protector trips and cuts off the supply is recorded.",
            "The trip temperature and the maximum temperature reached are compared with the safe limit for the insulation class."
        ]]
    },

    {
        match: /overload|overcurrent|over\s*current|locked\s*rotor/i,
        standard: "IEC 60947-4 / IEC 60034-1 (Overload / overcurrent)",
        hazard: "sustained overload or overcurrent",
        reasonPass: "the protection operated correctly and the sample withstood the overload without damage",
        reasonFail: "the protection failed to operate or the sample was damaged by the overload, resulting in {n} failure",
        procedure: [[
            "The {n} is run at its rated condition and then loaded above its rated current.",
            "The overcurrent is applied at the specified multiple of rated current (for example 1.5 times) for the specified time.",
            "The current, temperature and the operation of the protection device are monitored throughout.",
            "Afterwards the {n} is checked for damage and the protection trip current and time are compared with the requirement."
        ]]
    },

    {
        // "Vibration endurance" / "shock fatigue" belong on the shaker, not the motor life bench.
        match: { test: (s) => /endurance|fatigue|durability|life\s*test/i.test(s) && !/vibration|shaker|sine\s*sweep|random\s*vib|shock/i.test(s) },
        standard: "IEC 60034-1 (Endurance / life test)",
        hazard: "wear and fatigue over long operation",
        reasonPass: "the sample completed the full endurance run and stayed within the performance limits",
        reasonFail: "the sample wore out, seized or degraded beyond the limit during the endurance run, resulting in {n} failure",
        procedure: [[
            "The {n} is run continuously, or in the specified start-stop duty cycle, at its rated load.",
            "The run is continued for the specified number of operating hours or cycles.",
            "Bearing temperature, vibration, current and performance are monitored at set intervals during the run.",
            "At the end the {n} is inspected for wear and its performance is compared with the initial readings."
        ]]
    },

    {
        match: /ingress\s*protection|ip\s*rating|ip\s*code/i,
        standard: "IEC 60529 (IP code)",
        hazard: "ingress of solid objects and water",
        reasonPass: "no harmful ingress of dust or water occurred for the declared IP code",
        reasonFail: "dust or water entered beyond the limit for the declared IP code, resulting in {n} failure",
        procedure: [[
            "The declared IP code of the {n} is identified (the first digit for solids/dust, the second for water).",
            "The solids/dust test for the first digit is carried out (for example the dust chamber test for IP5X or IP6X).",
            "The water test for the second digit is carried out (dripping, spray, jets or immersion as defined by the code).",
            "After each test the {n} is opened and inspected for any dust or water ingress against the code's acceptance criteria."
        ]]
    },

    {
        match: /accelerated\s*ag|calendar\s*ag|accelerated\s*life|shelf\s*life/i,
        standard: "IEC 62660-1 (Calendar / accelerated aging)",
        hazard: "ageing and capacity fade over time",
        reasonPass: "the capacity and resistance stayed within the specified limits after the accelerated ageing period",
        reasonFail: "the capacity dropped or the resistance rose beyond the limit during ageing, resulting in {n} failure",
        procedure: [[
            "The initial capacity and internal resistance of the {n} are measured at 25 °C.",
            "The {n} is stored at an elevated temperature (for example 45 °C or 60 °C) and a fixed state of charge for the specified period.",
            "At set intervals the {n} is brought back to 25 °C and its capacity and resistance are re-measured.",
            "The capacity fade and resistance rise over time are calculated and compared with the acceptance limits."
        ]]
    },

    {
        match: /ground\s*continuity|earth\s*continuity|ground\s*bond|earth\s*bond|protective\s*earth|earth\s*bond/i,
        standard: "IEC 60335-1 / IEC 61010-1 (Earth / ground continuity)",
        hazard: "high resistance in the protective earth path",
        reasonPass: "the resistance of the earth path was below the specified limit at every accessible metal part",
        reasonFail: "the earth path resistance exceeded the specified limit, resulting in {n} failure",
        procedure: [[
            "A test current (typically 10 A to 25 A AC) is passed between the protective earth terminal and each accessible conductive part.",
            "The current is applied for the specified time (for example 1 minute) at each point.",
            "The voltage drop is measured and the resistance of the earth path is calculated.",
            "The measured resistance is compared with the limit (typically 0.1 Ω, plus the cord resistance where applicable)."
        ]]
    },

    {
        // A material's UL 94 burning class - not a battery pack fire test.
        match: /ul\s*94|vertical\s*burn|horizontal\s*burn|flammability.{0,25}(material|plastic)/i,
        standard: "UL 94 / IEC 60695-11-10 (Flammability of plastic materials)",
        hazard: "the material catching fire and spreading flame",
        reasonPass: "the material met the required UL 94 class (for example V-0) with no flaming drips igniting the cotton",
        reasonFail: "the material burned too long or dripped flaming particles, so it did not meet the required UL 94 class",
        procedure: [[
            "Five specimens of the {n} material are cut to size and conditioned at 23 °C and 50% RH for 48 hours.",
            "Each specimen is held vertically and a 20 mm flame is applied twice for 10 seconds, with cotton placed below.",
            "The after-flame and after-glow times are recorded, and whether drips ignite the cotton.",
            "The results are checked against the required UL 94 class (V-0, V-1 or V-2)."
        ]]
    },

    {
        match: /fire\s*safety|flammab|fire\s*test|fire\s*resist|\bburn/i,
        standard: "UL 94 / IEC 60695-11 / AIS-156 & GB 38031 (Fire)",
        hazard: "fire and flame spread",
        reasonPass: "the sample self-extinguished within the required time and the flame did not spread beyond the allowed limit",
        reasonFail: "the sample continued to burn or the flame spread beyond the limit, resulting in {n} failure",
        procedure: [[
            "The {n} (or its material sample) is mounted in the specified orientation in the flammability test chamber.",
            "A defined flame is applied to the sample for the specified time (for example two 10-second applications).",
            "The flame is removed and the after-flame / after-glow time and any flame spread or dripping are recorded.",
            "The results are compared with the required flammability class (for example UL 94 V-0) or the fire-safety acceptance criteria."
        ]]
    },

    {
        match: /firmware|software\s*valid|bms\s*firmware|functional\s*safety/i,
        standard: "ISO 26262 / IEC 61508 (Functional safety) / ISO 6469-1",
        hazard: "unsafe behaviour when a fault occurs",
        reasonPass: "the {n} handled every safety scenario correctly and stayed within its safe operating limits",
        reasonFail: "the {n} failed to act safely on a fault condition, resulting in {n} failure",
        procedure: [[
            "The {n} firmware / software version and its safety requirements are recorded.",
            "Each safety function is exercised by injecting its fault condition (for example an over-voltage, over-current, over-temperature or sensor fault) on the test bench or HIL setup.",
            "The {n}'s response - alarm, safe-state, current limiting, contactor opening or shutdown - is verified against the requirement and its timing limit.",
            "Boundary and fault-injection cases are repeated, and the pass / fail of each safety function is recorded."
        ]]
    },

    // ---- Ingress protection tests ----

    {
        match: /ip\s?6k9k|steam\s*jet|high\s*pressure/i,
        standard: "ISO 20653 (IP6K9K)",
        hazard: "high pressure and steam jet cleaning",
        reasonPass: "the sample withstood the high pressure water jets and no water entered the housing",
        reasonFail: "water entered the housing during the high pressure jet spray, resulting in {n} failure",
        procedure: [
            [
                "The {n} is mounted on a turntable and sprayed with water at 80 °C and a pressure of 80 to 100 bar.",
                "The nozzle is held 100 to 150 mm from the surface and the spray is applied at four angles: 0°, 30°, 60° and 90°.",
                "Each angle is applied for 30 seconds while the sample rotates slowly.",
                "After the test, the housing is opened and checked for water ingress."
            ],
            [
                "The {n} is sprayed with hot water at 80 °C under a pressure of 80 to 100 bar from a fan jet nozzle.",
                "The spray is directed from four angles, each for 30 seconds, with the sample turning on a rotating table.",
                "The total spray time is 2 minutes.",
                "The housing is then opened and inspected for water entry."
            ]
        ]
    },

    {
        match: /ipx\s?7|ipx7|immersion|submerg/i,
        standard: "IEC 60529 / IS 12063 (IPX7)",
        hazard: "the ingress of water",
        reasonPass: "no water ingress was observed during the testing process and the sample remained fully functional",
        reasonFail: "water ingress was observed during the testing process, resulting in {n} failure",
        procedure: [
            [
                "The {n} is fully immersed in clean water at a depth of 1 metre, excluding the height of the sample.",
                "The test is done for 30 minutes, with the sample kept undisturbed under water.",
                "After the test, the sample is taken out, wiped dry and opened.",
                "The inside of the sample is checked for water ingress."
            ],
            [
                "The {n} is completely submerged in clean water so that its lowest point is 1 metre below the water surface.",
                "It is held under water, without any disturbance, for 30 minutes.",
                "The sample is then removed, the outer surface is wiped dry and it is left to drain.",
                "The housing is opened and the interior is inspected for any water entry."
            ]
        ]
    },

    {
        match: /ipx\s?6|ipx6|water\s*jet/i,
        standard: "IEC 60529 (IPX6)",
        hazard: "powerful water jets",
        reasonPass: "the sample resisted the water jets from every direction and stayed dry inside",
        reasonFail: "water entered the sample during the water jet spray, resulting in {n} failure",
        procedure: [
            [
                "The {n} is sprayed with a powerful water jet from a 12.5 mm nozzle at a flow of 100 litres per minute.",
                "The nozzle is held 2.5 to 3 metres away and the jet is applied from all directions.",
                "The test is done for at least 3 minutes, covering the whole surface of the sample.",
                "After the test, the housing is opened and checked for water ingress."
            ],
            [
                "A 12.5 mm jet nozzle delivering 100 litres per minute is directed at the {n} from a distance of 2.5 to 3 metres.",
                "The jet is applied from every practicable direction so that the whole surface is covered.",
                "The spraying is continued for a minimum of 3 minutes.",
                "The sample is then opened and the interior inspected for water."
            ]
        ]
    },

    // ---- Mechanical and environmental tests ----

    {
        // "random" alone is too greedy - it matched "Random unknown test".
        match: /vibrat|shaker|sine\s*sweep|random\s*(vibration|profile)/i,
        standard: "IEC 60068-2-6 / IEC 60068-2-64",
        hazard: "vibration and mechanical fatigue",
        reasonPass: "the sample withstood the full vibration profile in all three axes without any loosening or damage",
        reasonFail: "the sample developed looseness or damage during the vibration test, resulting in {n} failure",
        procedure: [
            [
                "The {n} is mounted rigidly on the vibration shaker using the test fixture.",
                "The specified vibration profile is applied in the X, Y and Z axes, one axis at a time.",
                "The test is done for 8 hours in each axis, giving 24 hours in total.",
                "The sample is monitored during the test and inspected afterwards for loosening or damage."
            ],
            [
                "The {n} is clamped to the shaker table through the specified fixture.",
                "A resonance search sweep is run first, and then the specified vibration profile is applied.",
                "Each of the three axes is vibrated for 8 hours.",
                "The resonance sweep is repeated at the end and compared with the first reading."
            ]
        ]
    },

    {
        match: /thermal\s*shock/i,
        standard: "IEC 60068-2-14 (Test Na, thermal shock)",
        hazard: "sudden changes of temperature",
        reasonPass: "the sample completed all temperature cycles without cracking, leakage or loss of function",
        reasonFail: "the sample cracked or stopped working during the temperature cycles, resulting in {n} failure",
        procedure: [
            [
                "The {n} is exposed alternately to the specified low and high temperature extremes (for example −40 °C and +85 °C, or as stated in the test requirement) inside the thermal shock chamber.",
                "It is held for 30 minutes at each temperature, and moved between the chambers within 30 seconds.",
                "The test is done for the specified number of cycles (typically 100).",
                "After the test, the sample is brought back to room temperature and checked for cracks and leakage."
            ],
            [
                "The {n} is placed in the cold chamber at the specified low temperature and then transferred to the hot chamber at the specified high temperature.",
                "The dwell at each temperature is 30 minutes and the transfer takes not more than 30 seconds.",
                "This cycle is repeated for the specified number of cycles (typically 100) without interruption.",
                "The sample is then allowed to recover at room temperature and inspected."
            ]
        ]
    },

    {
        // Temperature CYCLING (gradual ramp) - different from thermal SHOCK.
        match: /temperature\s*cycl|temp\s*cycl|ambient\s*temp|thermal\s*cycl/i,
        standard: "IEC 60068-2-14 (Test Nb, temperature change) / IEC 60068-2-1 & -2-2",
        hazard: "repeated slow heating and cooling",
        reasonPass: "the sample completed all temperature cycles without cracking, leakage or loss of function",
        reasonFail: "the sample cracked, leaked or stopped working during the temperature cycles, resulting in {n} failure",
        procedure: [[
            "The {n} is placed in a temperature chamber and stabilised at room temperature.",
            "The temperature is ramped slowly (about 1 to 3 °C per minute) down to the specified low limit (for example −40 °C) and held for a 1 to 2 hour dwell.",
            "The temperature is then ramped up at the same rate to the specified high limit (for example +85 °C, or as stated in the test requirement) and held for the same dwell time.",
            "This low-to-high cycle is repeated for the specified number of cycles (typically 5 to 10).",
            "After the final cycle the {n} is returned to room temperature and checked for function, cracks and leakage."
        ]]
    },

    {
        match: /salt\s*spray|salt\s*fog|corrosion/i,
        standard: "ISO 9227 (NSS) / ASTM B117",
        hazard: "corrosion caused by salt",
        reasonPass: "the sample showed no red rust or coating damage after the full salt spray exposure",
        reasonFail: "the sample showed corrosion beyond the allowed limit, resulting in {n} failure",
        procedure: [
            [
                "The {n} is placed in the salt spray cabinet at an angle of 15° to 25° from the vertical.",
                "It is sprayed continuously with a 5% sodium chloride solution at a chamber temperature of 35 °C.",
                "The test is done for 96 hours without interruption.",
                "The sample is then rinsed in clean water and the surface is graded for rust and coating loss."
            ],
            [
                "The {n} is mounted in the cabinet with the non-test surfaces masked.",
                "A neutral salt fog of 5% sodium chloride solution is applied continuously at 35 °C.",
                "The exposure is continued for 96 hours, with the spray rate checked every 24 hours.",
                "After exposure the sample is washed, dried and examined for corrosion."
            ]
        ]
    },

    {
        match: /mechanical\s*shock|mechanical\s*impact|half\s*sine|shock\s*pulse|impact\s*test/i,
        standard: "IEC 60068-2-27 (Test Ea) / ISO 16750-3",
        hazard: "sudden mechanical shock pulses",
        reasonPass: "the sample withstood all shock pulses in every axis without damage or loss of function",
        reasonFail: "the sample was damaged or stopped working after the shock pulses, resulting in {n} failure",
        procedure: [[
            "The {n} is mounted rigidly on the shock machine using the specified fixture.",
            "Half-sine shock pulses of the specified peak acceleration and duration (for example 50 g for 11 ms) are applied.",
            "Three shocks are applied in each direction of the three axes, giving 18 shocks in total.",
            "The sample is monitored during the test and inspected afterwards for cracks, loosening and loss of function."
        ]]
    },

    {
        match: /thermal\s*runaway|thermal\s*propagation/i,
        standard: "AIS-156 / GB 38031 / ISO 6469-1 (Thermal propagation)",
        hazard: "internal thermal runaway of a cell",
        reasonPass: "thermal runaway of one cell did not propagate through the pack and gave the required warning time before any hazard reached outside the pack",
        reasonFail: "the thermal runaway propagated through the pack, resulting in {n} failure",
        procedure: [[
            "The {n} is fully charged and fitted with thermocouples on the trigger cell and the neighbouring cells.",
            "Thermal runaway is triggered in one cell by the specified method (nail penetration, local heating or overcharge).",
            "The pack is observed for propagation to adjacent cells, temperature rise, smoke and fire.",
            "The time to any hazardous event outside the pack is recorded and must meet the standard's minimum warning time."
        ]]
    },

    {
        match: /energy\s*density|specific\s*energy/i,
        standard: "IEC 62660-1 / ISO 12405-4",
        hazard: "insufficient usable energy per unit mass or volume",
        reasonPass: "the measured energy density met or exceeded the specified target",
        reasonFail: "the measured energy density was below the specified target, resulting in {n} shortfall",
        procedure: [[
            "The {n} is fully charged at 25 °C using the standard charging method and rested for the specified time.",
            "It is then discharged at the specified rate (for example 1C) down to the cut-off voltage.",
            "The delivered capacity (Ah) and the average discharge voltage are recorded to calculate the delivered energy (Wh).",
            "The energy density is calculated as delivered energy divided by the mass (Wh/kg) and by the volume (Wh/L)."
        ]]
    },

    {
        match: /capacity\s*retention|capacity\s*fade|state\s*of\s*health/i,
        standard: "IEC 62660-1 / IS 16893 (Capacity retention)",
        hazard: "loss of capacity over storage or cycling",
        reasonPass: "the capacity retention stayed within the specified limit after the storage/cycling period",
        reasonFail: "the capacity fell below the specified retention limit, resulting in {n} failure",
        procedure: [[
            "The initial capacity of the {n} is measured with a full charge and discharge at 25 °C.",
            "The {n} is then stored, or cycled, at the specified temperature and state of charge for the required period.",
            "The capacity is measured again under the same conditions as the initial measurement.",
            "The capacity retention is calculated as the final capacity divided by the initial capacity, expressed as a percentage."
        ]]
    },

    {
        match: /internal\s*resistance|dc\s*-?\s*ir|dcir/i,
        standard: "IEC 62660-1 (DC internal resistance)",
        hazard: "high internal resistance reducing performance",
        reasonPass: "the measured internal resistance was within the specified limit",
        reasonFail: "the internal resistance exceeded the specified limit, resulting in {n} failure",
        procedure: [[
            "The {n} is brought to the specified state of charge and stabilised at 25 °C.",
            "A defined current pulse is applied for a set time (for example 10 s) and the resulting voltage drop is recorded.",
            "The DC internal resistance is calculated from the voltage change divided by the current change (ΔV / ΔI).",
            "The measurement is repeated at several states of charge and the values are compared with the limit."
        ]]
    },

    {
        match: /impedance|spectroscopy|\beis\b/i,
        standard: "Electrochemical Impedance Spectroscopy (EIS), per IEC 62660-1",
        hazard: "abnormal cell impedance",
        reasonPass: "the impedance spectrum was within the expected range with no abnormal rise",
        reasonFail: "the impedance spectrum showed abnormal values, indicating {n} degradation",
        procedure: [[
            "The {n} is stabilised at the specified state of charge and temperature.",
            "A small AC signal is applied over a range of frequencies (typically 10 kHz down to 10 mHz).",
            "The voltage and current responses are recorded to obtain the impedance at each frequency.",
            "The results are plotted as a Nyquist plot and the ohmic, charge-transfer and diffusion resistances are compared with the reference."
        ]]
    },

    {
        match: /insulation\s*resistance|megger|insulation\s*test/i,
        standard: "IEC 60664 / ISO 6469-1 / IEC 60034-1 (Insulation resistance)",
        hazard: "insufficient insulation between live parts and the chassis",
        reasonPass: "the insulation resistance was above the specified minimum in every measurement",
        reasonFail: "the insulation resistance fell below the specified minimum, resulting in {n} failure",
        procedure: [[
            "The {n} is de-energised and its live terminals (for example the supply, output or winding terminals as applicable) are prepared for the test.",
            "A DC test voltage (typically 500 V, or 1000 V for higher-voltage systems) is applied between the live parts and the frame or enclosure with an insulation tester (Megger).",
            "The insulation resistance is read after the value has stabilised (for example after 1 minute).",
            "The measured resistance (in MΩ) is compared with the standard's minimum requirement."
        ]]
    },

    {
        match: /rapid\s*discharg|fast\s*discharg|high\s*-?\s*rate\s*discharg/i,
        standard: "IEC 62660-1 (High-rate discharge)",
        hazard: "high-rate discharge stress",
        reasonPass: "the pack delivered the high-rate discharge within limits without overheating or shutdown",
        reasonFail: "the pack overheated or cut off during the high-rate discharge, resulting in {n} failure",
        procedure: [[
            "The {n} is fully charged and stabilised at 25 °C.",
            "It is then discharged at the specified high rate (for example 2C or 3C) down to the cut-off voltage.",
            "The voltage, current and temperature are monitored continuously during the discharge.",
            "The delivered capacity and the peak temperature are recorded and compared with the acceptance limits."
        ]]
    },

    {
        match: /ip\s*-?6?[78]\b/i,
        standard: "IEC 60529 / IS 12063 (IP67 / IP68 immersion)",
        hazard: "the ingress of dust and water on immersion",
        reasonPass: "no harmful ingress of dust or water was found after the immersion test",
        reasonFail: "water or dust entered the enclosure during the immersion test, resulting in {n} failure",
        procedure: [[
            "The {n} is first subjected to the dust test (IP6X) in a dust chamber to confirm it is dust-tight.",
            "For the water test the {n} is immersed so its top is at least 0.15 m below the surface (or to the specified depth for IP68).",
            "It is kept fully immersed for 30 minutes.",
            "The {n} is then removed, wiped dry and opened, and the inside is inspected for any water or dust ingress."
        ]]
    },

    {
        match: /drop\s*test|free[\s-]*fall|\bdropped\b|free\s*drop/i,
        standard: "IEC 60068-2-31 (Drop / free-fall)",
        hazard: "mechanical impact and rough handling",
        reasonPass: "the sample survived every drop without cracking or loss of function",
        reasonFail: "the sample cracked or stopped working after the drops, resulting in {n} failure",
        procedure: [
            [
                "The {n} is dropped freely from the specified height onto a rigid steel surface.",
                "The drop is repeated on each face, edge and corner of the sample.",
                "The sample is inspected after every drop for cracks and loose parts.",
                "At the end, the housing and the internal assemblies are checked for damage."
            ],
            [
                "The {n} is held at the specified drop height above a steel impact plate and released in free fall.",
                "Each of the marked faces, edges and corners is subjected to one drop.",
                "After every drop the sample is checked for cracking, deformation and loss of function.",
                "The internal parts are examined once all the drops are completed."
            ]
        ]
    }

];

const GENERIC_PROCEDURE = {

    standard: "As per the applicable product specification",

    hazard: "the specified test conditions",

    reasonPass: "the sample met every acceptance criterion throughout the test",

    reasonFail: "the sample did not meet one or more acceptance criteria, resulting in {n} failure",

    procedure: [
        [
            "The {n} is subjected to the specified test conditions as per the applicable standard.",
            "The test conditions are held steady for the full duration of the test.",
            "The test parameters are monitored and recorded continuously throughout.",
            "After the test, the sample is inspected and its performance is compared with the readings taken before the test."
        ],
        [
            "The {n} is set up on the test bench and stabilised at the required conditions.",
            "The specified condition is then applied continuously for the full test duration.",
            "All test parameters are logged at the defined intervals.",
            "On completion, the sample is examined and its functional performance is re-checked."
        ]
    ]

};

function pickProcedure(testName) {

    // Normalise fancy dashes (en dash, em dash, non-breaking hyphen, minus) to a
    // plain hyphen so names like "Short-Circuit" match regardless of the dash.
    const t = String(testName).replace(/[‐-―−­]/g, "-");

    return (

        PROCEDURE_TEMPLATES.find((tp) => tp.match.test(t)) || GENERIC_PROCEDURE

    );

}

// The generated sentences already supply the word "test" ("the {t} test",
// "{t} testing is performed"). Strip a trailing "test"/"testing" the user
// typed into Test Name, so "Over charge test" does not become
// "Over charge test test".
function testLabel(test) {

    return test.replace(/\s*testing$/i, "").replace(/\s*tests?$/i, "").trim();

}

// The short noun used in the procedure and conclusion: "motor", "battery
// pack", etc. Falls back to "sample" when the product name gives nothing.
function productNoun(product) {

    const match = /\b(motor|gear\s?box|battery\s*pack|battery|pack|cell|charger|controller|housing|connector|harness|pump|sensor)\b/i
        .exec(product);

    return match ? match[0].toLowerCase() : "sample";

}

// ===========================================
// AUTO: PROCEDURE
// Short, plain points describing only the test condition and its duration.
// ===========================================

function buildProcedure(template, noun){

    const points = nextVariant("procedure", template.procedure)

        .map((line) => `<li>${line.replace(/\{n\}/g, noun)}</li>`)

        .join("");

    return `
    <ol class="procedure-steps">${points}</ol>

    <p class="proc-note">Standard followed: <b>${template.standard}</b>.</p>`;

}

// ===========================================
// AUTO: OBJECTIVE
// Each press of Auto steps to the next wording.
// {p} product, {t} test name, {h} the hazard the test challenges.
// ===========================================

const OBJECTIVE_VARIANTS = [

    `To evaluate the characteristics of the <b>{p}</b>, <b>{t}</b> testing is ` +
    `performed to verify the product's ability to resist <b>{h}</b>, so as to ` +
    `ensure functionality, safety and product compliance.`,

    `The <b>{t}</b> test is carried out on the <b>{p}</b> to confirm that the ` +
    `product can resist <b>{h}</b> without any loss of function, and to establish ` +
    `that it complies with the applicable requirements.`,

    `This test evaluates the ability of the <b>{p}</b> to withstand <b>{h}</b>. ` +
    `The <b>{t}</b> test is performed to verify that the functionality, safety ` +
    `and build quality of the product remain within the specified limits.`,

    `To verify the performance and durability of the <b>{p}</b>, the <b>{t}</b> ` +
    `test is conducted to assess how well the product resists <b>{h}</b> and ` +
    `whether it continues to meet the acceptance criteria.`

];

// Remembers which variant each field last showed, so Auto advances.
const variantIndex = { objective: -1, procedure: -1, PASS: -1, FAIL: -1 };

function nextVariant(key, list){

    variantIndex[key] = (variantIndex[key] + 1) % list.length;

    return list[variantIndex[key]];

}

// What Auto last wrote into each field. Pressing Auto again just cycles the
// wording; replacing text the USER typed asks first (it could not be undone).
const lastAutoHtml = {};

function autoGenerateField(type){

    const target = document.getElementById(type === "objective" ? "objective" : type === "procedure" ? "procedure" : "");
    if (target && target.innerText.trim() && target.innerHTML !== lastAutoHtml[type] &&
        !confirm("Replace the text you typed in this section with the automatic wording?")) return;

    const product =
    document.getElementById("product").innerText.trim();

    const test =
    document.getElementById("testName").innerText.trim();

    const template = pickProcedure(test);

    if(type==="objective"){

        document.getElementById("objective").innerHTML =

            nextVariant("objective", OBJECTIVE_VARIANTS)
                .replace(/\{p\}/g, product || "the product")
                .replace(/\{t\}/g, testLabel(test) || "specified")
                .replace(/\{h\}/g, template.hazard);

        checkPageFit();

    }

    if(type==="procedure"){

        document.getElementById("procedure").innerHTML =
            buildProcedure(template, productNoun(product));

        // Fill the Standard field only when the user has left it blank.
        const standardEl = document.getElementById("standard");

        if (!standardEl.innerText.trim()) {

            standardEl.innerText = template.standard;

        }

        checkPageFit();

    }

    if (target) lastAutoHtml[type] = target.innerHTML;

}

// ===========================================
// TEST PROCEDURE - MANUAL / COLUMNS
// Two ways to fill the section: write it yourself (Manual) or let the AI
// write it (Auto). Manual drops in the empty A / a. b. c. outline the
// printed report uses, so the shape is there to type into.
// ===========================================

const PROCEDURE_OUTLINE =
    '<div><b>A. Test Procedure 1</b></div>' +
    '<div>a.&nbsp;</div>' +
    '<div>b.&nbsp;</div>' +
    '<div>c.&nbsp;</div>';

function procedureManual(btn) {

    const box = document.getElementById("procedure");
    if (!box) return;

    // Never wipe what is already written - just put the cursor there.
    if (!box.innerText.trim()) {
        box.innerHTML = PROCEDURE_OUTLINE;
        box.dispatchEvent(new Event("input", { bubbles: true }));
        checkPageFit();
    }

    box.focus();

    // Cursor at the end of the first empty line ("a."), ready to type.
    try {
        const line = box.querySelectorAll("div")[1] || box;
        const r = document.createRange();
        r.selectNodeContents(line);
        r.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
    } catch (e) { /* selection is a nicety, not worth failing over */ }

}

// ===========================================
// COLUMNS FOR ANY SECTION
// Every section heading that holds written text carries a "Columns: N"
// button. Product Details, Test Objective, Test Equipment, Test Procedure,
// Observation, Conclusion and Recommendation all work the same way.
// ===========================================

// The boxes that offer it, in report order. New Report walks this list.
const COLUMN_BOXES = [
    "prodSpecs", "objective", "equipment", "procedure",
    "observation", "resultText", "conclusion", "recommendation"
];

// A wrapper this code made. .proc-block is the v406 name, still read so a
// report saved then comes back grouped rather than as loose lines.
const COL_BLOCK_SEL = ".col-block, .proc-block";

// 1 -> 2 -> 3 -> 1. The choice belongs to the report, so it is saved with it.
function cycleColumns(btn, id) {

    const now = columnsOf(id);

    setColumns(id, now === 3 ? 1 : now + 1);

    saveColumnChoices();

    checkPageFit();

}

function columnsOf(id) {

    const box = document.getElementById(id);
    if (!box) return 1;

    return box.classList.contains("cols-3") ? 3 : box.classList.contains("cols-2") ? 2 : 1;

}

function setColumns(id, n) {

    const box = document.getElementById(id);
    if (!box) return;

    n = n === 2 || n === 3 ? n : 1;

    // In columns each block must travel as ONE piece, or the grid puts
    // "B. Test Procedure 2" in one column and its last step in the next.
    if (n > 1) groupColumnBlocks(id); else ungroupColumnBlocks(id);

    box.classList.remove("cols-2", "cols-3");
    if (n > 1) box.classList.add("cols-" + n);

    const btn = document.querySelector('.cols-btn[data-for="' + id + '"]');
    if (btn) btn.textContent = "Columns: " + n;

}

// One key for the whole report: {"procedure":3,"equipment":2}. Only the boxes
// that are not 1 are written, so a plain report stores nothing.
function saveColumnChoices() {

    const map = {};
    COLUMN_BOXES.forEach((id) => { const n = columnsOf(id); if (n > 1) map[id] = n; });

    try {
        if (Object.keys(map).length) localStorage.setItem("reportCols", JSON.stringify(map));
        else localStorage.removeItem("reportCols");
    } catch (e) { /* storage full - the report on screen is unaffected */ }

}

function restoreColumnChoices() {

    let map = {};

    try { map = JSON.parse(localStorage.getItem("reportCols") || "{}") || {}; } catch (e) { map = {}; }

    // v406 stored the procedure on its own; keep those drafts working.
    const old = parseInt(localStorage.getItem("procedureCols") || "0", 10);
    if (old > 1 && !map.procedure) map.procedure = old;

    COLUMN_BOXES.forEach((id) => setColumns(id, parseInt(map[id], 10) || 1));

}

// A line that opens a new block: "A. Test Procedure 1", "1. Soak test", or any
// line the user made bold - the shapes the printed report uses.
function isColumnHeading(el) {

    const t = (el.textContent || "").trim();
    if (!t) return false;

    if (/^[A-Z][.)]\s/.test(t) || /^\d+[.)]\s*(test\s+)?procedure\b/i.test(t)) return true;

    // Entirely bold / a heading tag, and short enough to be a heading.
    const b = el.querySelector("b, strong");
    return !!b && b.textContent.trim() === t && t.length < 60;

}

// Wrap each block (its heading plus the lines under it) in one .col-block.
function groupColumnBlocks(id) {

    const box = document.getElementById(id);
    if (!box) return;

    ungroupColumnBlocks(id);

    const kids = [...box.children];
    if (!kids.length) return;

    // Nothing that looks like a heading: split the lines into even blocks
    // instead, so the columns still balance rather than turning every single
    // line into its own cell.
    const heads = kids.filter(isColumnHeading).length;
    const per = heads ? 0 : Math.max(1, Math.ceil(kids.length / columnsOf(id)));

    let block = null;

    kids.forEach((kid, i) => {

        const starts = heads ? isColumnHeading(kid) : (i % per === 0);

        if (starts || !block) {
            block = document.createElement("div");
            block.className = "col-block";
            box.insertBefore(block, kid);
        }

        block.appendChild(kid);

    });

}

// True only when the blocks no longer match what was typed - so a click on the
// text toolbar (which blurs the box) does not rebuild the DOM under the cursor
// for nothing.
function columnsNeedGrouping(id) {

    const box = document.getElementById(id);
    if (!box || !box.children.length) return false;

    const kids = [...box.children];

    if (kids.some((k) => !k.matches(COL_BLOCK_SEL))) return true;

    // A heading that is not the first line of its block started a new block
    // that has not been given a cell of its own yet.
    return kids.some((b) => [...b.children].slice(1).some(isColumnHeading));

}

// Back to plain lines, so typing in one column behaves normally again.
function ungroupColumnBlocks(id) {

    const box = document.getElementById(id);
    if (!box) return;

    box.querySelectorAll(":scope > " + COL_BLOCK_SEL.split(", ").join(", :scope > ")).forEach((b) => {
        while (b.firstChild) box.insertBefore(b.firstChild, b);
        b.remove();
    });

}

// Text typed while the columns are on gets its own cell as soon as the user
// leaves the box (never while they are typing in it - that would move the
// cursor mid-sentence).
(function watchColumnTyping() {

    COLUMN_BOXES.forEach((id) => {

        const box = document.getElementById(id);
        if (!box) return;

        box.addEventListener("blur", () => {

            if (columnsOf(id) < 2 || !columnsNeedGrouping(id)) return;

            groupColumnBlocks(id);
            checkPageFit();

        });

    });

})();

// Kept because the Test Procedure heading and the saved reports from v406
// still call these by name.
function procedureCycleColumns(btn) { cycleColumns(btn, "procedure"); }
function procedureColumns() { return columnsOf("procedure"); }
function setProcedureColumns(n) { setColumns("procedure", n); }


// ===========================================
// OFFLINE ENGLISH CORRECTION
// Tanglish -> report English, then spelling and grammar.
// Runs fully offline, so the passes are ordered:
// phrases (longest first) -> single words -> grammar -> casing.
// ===========================================

// Multi-word Tanglish phrases. These MUST run before the word pass,
// otherwise "nalla" would be replaced before "nalla irukku" is seen.
const TANGLISH_PHRASES = [

    // Negated forms first: "water ulla pochu illa" means the opposite of
    // "water ulla pochu", so the positive rule must not win.
    [/\bwater\s+ulla\s+(poch?u|poguthu|ponuchu)\s+(illa|illai)\b/gi, "no water ingress was observed"],
    [/\bwater\s+ulla\s+(pogala|povala|ponale)\b/gi, "no water ingress was observed"],
    [/\bleak\s+(aagala|aagalai|illa|illai)\b/gi, "no leakage was observed"],
    [/\bsound\s+(varala|varalai|illa|illai)\b/gi, "no abnormal noise was generated"],
    [/\bcrack\s+(illa|illai)\b/gi, "no crack was observed"],
    [/\brust\s+(illa|illai)\b/gi, "no rust formation was observed"],

    [/\bproblem\s+(illa|illai|kidaiyathu)\b/gi, "no abnormality was observed"],
    [/\bonnum\s+(illa|illai)\b/gi, "nothing abnormal was observed"],
    [/\bwater\s+ulla\s+(poch?u|poguthu|ponuchu)\b/gi, "water ingress was observed"],
    [/\bleak\s+(aagudhu|aaguthu|aachu|aayiduchu)\b/gi, "leakage was observed"],
    [/\bsound\s+(varuthu|varudhu|vandhuchu)\b/gi, "abnormal noise was generated"],
    [/\bsapt?am\s+(varuthu|varudhu)\b/gi, "abnormal noise was generated"],
    [/\bvelai\s+(seiyuthu|seyyuthu|seiyudhu)\b/gi, "is functioning"],
    [/\bvelai\s+(seiyala|seyyala|aagala)\b/gi, "did not function"],
    [/\bstart\s+(aagala|aagalai|aavala)\b/gi, "did not start"],
    [/\bstart\s+(aachu|aagiduchu|aayiduchu)\b/gi, "started successfully"],
    [/\bwork\s+(aagala|aagalai|aavala)\b/gi, "did not operate"],
    [/\bwork\s+(aagudhu|aaguthu|aachu)\b/gi, "is operating"],
    [/\bnalla\s+(irukku|iruku|iruk+u)\b/gi, "is in good condition"],
    [/\bsari\s+(illa|illai)\b/gi, "is not correct"],
    [/\bcheck\s+(panne+n?|pannom|pannitom|pannitten)\b/gi, "was checked"],
    [/\btest\s+(panne+n?|pannom|pannitom|pannitten)\b/gi, "was tested"],
    [/\bclean\s+(panne+n?|pannom|pannitom)\b/gi, "was cleaned"],
    [/\bfix\s+(panne+n?|pannom|pannitom)\b/gi, "was rectified"],
    [/\bwater\s+(vandhuchu|vanthuchu|vandhuruchu)\b/gi, "water ingress was observed"],
    [/\bcrack\s+(irukku|iruku|vandhuchu)\b/gi, "has a crack"],
    [/\bdamage\s+(illa|illai)\b/gi, "no damage was observed"],
    [/\bpower\s+(illa|illai|poyiduchu)\b/gi, "no power was available"],
    [/\brust\s+(irukku|iruku|vandhuchu)\b/gi, "rust formation was observed"],
    [/\bunit\s+(sududhu|sududhu|soodaguthu)\b/gi, "the unit became hot"],
    [/\bno\s+any\b/gi, "no"]

];

// Single Tanglish words -> English equivalents.
const TANGLISH_WORDS = {

    nalla: "good",
    seri: "satisfactory",
    sari: "correct",
    thappu: "incorrect",
    illa: "not present",
    illai: "not present",
    irukku: "is present",
    iruku: "is present",
    // "ulla"/"ullae" mean INSIDE - the opposite of "illa". Listed explicitly so
    // they resolve exactly instead of being fuzzy-matched onto "illa".
    ulla: "inside",
    ullae: "inside",
    ulle: "inside",
    veliya: "outside",
    poidichu: "went in",
    poiduchu: "went in",
    kalichu: "later",
    kazhichu: "later",
    irundhuchu: "was there",
    irunthuchu: "was there",
    kidaiyathu: "is not present",
    vandhuchu: "occurred",
    vanthuchu: "occurred",
    aachu: "completed",
    aagala: "did not occur",
    aagalai: "did not occur",
    mudinjidhu: "completed",
    mudinjuchu: "completed",
    romba: "very",
    konjam: "slightly",
    jasti: "excessive",
    adhigam: "excessive",
    kammi: "low",
    kuraivu: "low",
    sudu: "heat",
    sooda: "hot",
    sududhu: "is overheating",
    odanjiduchu: "is broken",
    odanjuruchu: "is broken",
    utho: "leaking",
    sotta: "leaking",
    pathom: "observed",
    paarthom: "observed",
    vela: "operation",
    velai: "operation",
    sethu: "damaged",
    nalladhu: "acceptable",
    mosam: "poor",
    modhal: "initial",
    kadaisi: "final",
    ippo: "at present",
    apram: "afterwards",
    munnadi: "before",
    pinnadi: "after"

};

// Common misspellings seen in the test logs. Anything not listed here is
// still handled by the fuzzy pass further down.
const SPELLING = {

    gud: "good",
    goood: "good",
    teh: "the",
    wrk: "work",
    wrkng: "working",
    gearbox: "gear box",
    hv: "have",
    plz: "please",
    thn: "then",
    nd: "and"

};

// Correctly spelled words the fuzzy pass can snap a misspelling onto.
// Keep this focused on the vocabulary that actually appears in the reports.
const ENGLISH_LEXICON = [

    "abnormal","acceptable","acceptance","after","ambient","analysis","assembly",
    "battery","before","bearing","bolt","bracket","broken","bubble","cable",
    "calibration","capacity","charge","charging","check","checked","chamber",
    "circuit","clamp","cleaned","clearance","completed","component","condition",
    "connector","connection","continuity","controller","corrosion","crack",
    "cracked","current","cycle","damage","damaged","defect","deformation",
    "degradation","deviation","discharge","displacement","drain","during",
    "durability","efficiency","electrical","enclosure","equipment","excessive",
    "failed","failure","fastener","fitment","fixture","functional","functioning",
    "gasket","gear","grease","heat","heating","housing","humidity","impact",
    "ingress","initial","inspection","inspected","installed","insulation",
    "internal","leakage","leaking","loose","lubricant","measured","measurement",
    "mechanical","moisture","motor","mounting","noise","normal","observation",
    "observed","operating","operation","overheating","performance","physical",
    "pressure","procedure","rating","reading","recorded","reference","removed",
    "resistance","result","rotation","rust","sample","satisfactory","screw",
    "seal","sealing","serial","shaft","shock","specification","speed","stable",
    "standard","started","structural","surface","temperature","terminal","test",
    "tested","testing","tightened","tolerance","torque","unit","vibration",
    "visual","voltage","water","wear","weight","winding","working","successful",
    "success","receive","received","inside","outside","good","hot","cold","dry",
    "wet","high","low","correct","incorrect","present","absent","power"

];

// Ordinary English that must never be "corrected" into something else.
const STOPWORDS = [

    "the","is","was","were","a","an","and","or","of","in","on","at","to","for",
    "with","no","not","but","after","before","during","from","by","as","it",
    "its","this","that","there","has","have","had","been","be","are","all",
    "any","each","per","than","then","when","while","also","only","both","more",
    "less","very","we","i","he","she","they","did","does","do","up","down",
    "out","off","over","under","into","within","without","min","mm","kg","hr",
    "sec","deg","one","two","three","four","five","six","seven","eight","nine",
    "ten","ok"

];

// Grammar tidy-up for the phrasing that survives the passes above.
const GRAMMAR_RULES = [

    // First person has no place in a validation report.
    [/\b(we|i)\s+(was|were)\b/gi, "the sample was"],
    [/\b(we|i)\s+(observed|checked|tested|inspected|measured)\b/gi, "the sample was $2"],

    // "was receive" -> "was received", for the verbs that actually turn up.
    [/\bwas (receive|observe|record|check|test|inspect|complete|damage|expose|clean|remove|install)\b/gi, "was $1d"],

    [/\bis success\b/gi, "was successful"],
    [/\bvery excessive\b/gi, "excessive"],

    // Safety net for any "<something> was observed" that a stray "illa"
    // turned into a contradiction.
    [/\bwas observed not present\b/gi, "was not observed"],
    [/\bwas observed is not present\b/gi, "was not observed"],

    // Supply the missing verb in bare "noun + adjective" observations.
    [/\b(temperature|noise|vibration|current|voltage|pressure|heat|wear|leakage)\s+(excessive|low|high)\b/gi, "$1 is $2"],
    [/\b(motor|unit|sample|housing|battery|gear box|seal|shaft|bearing)\s+(good|damaged|broken|hot|loose)\b/gi, "$1 is $2"],
    [/\bis good\b/gi, "is in good condition"],

    [/\bis working good\b/gi, "is functioning correctly"],
    [/\bworking good\b/gi, "functioning correctly"],
    [/\bworking fine\b/gi, "functioning correctly"],
    [/\bnot working\b/gi, "not functioning"],
    // Explicit verb list on purpose: a generic "(\w+)ed" would turn
    // "did not exceed" into "did not exce".
    [/\b(did|does|do) not (start|work|operate|function|pass|fail|occur|complete|test|check|leak|change|open|close|move|damage)ed\b/gi, "$1 not $2"],
    [/\bthere is no problem\b/gi, "no abnormality was observed"],
    [/\bno problem\b/gi, "no abnormality"],
    [/\bsame like\b/gi, "the same as"],
    [/\bmore better\b/gi, "better"],
    [/\bvery much good\b/gi, "satisfactory"],
    [/\bcan able to\b/gi, "is able to"],
    [/\bi\b/g, "I"],
    [/\bdont\b/gi, "do not"],
    [/\bdidnt\b/gi, "did not"],
    [/\bwasnt\b/gi, "was not"],
    [/\bcant\b/gi, "cannot"],
    [/\bok\b/gi, "satisfactory"],
    [/\s+([,.;:!?])/g, "$1"],
    [/([,;:])(?=\S)/g, "$1 "]

];

// Technical terms that must stay upper case in the final text.
const TECHNICAL_TERMS = [

    "IPX7", "IPX6", "IPX5", "IP67", "IP68", "IP6K9K",
    "BMS", "MSI", "DC", "AC", "PCB", "ECU", "LED",
    "RPM", "IR", "NSS", "RH", "SOC", "SOH"

];

// ---------- Fuzzy spelling ----------

// Words that are already correct and must be left alone.
const KNOWN_WORDS = new Set([

    ...ENGLISH_LEXICON,
    ...STOPWORDS,
    ...TECHNICAL_TERMS.map((t) => t.toLowerCase())

]);

// Every candidate the fuzzy pass may snap onto: correct English words map
// to themselves, Tanglish words map to their English equivalent.
const FUZZY_CANDIDATES = [

    ...ENGLISH_LEXICON.map((w) => [w, w]),

    ...Object.keys(TANGLISH_WORDS).map((w) => [w, TANGLISH_WORDS[w]])

];

function levenshtein(a, b) {

    // Classic row-by-row dynamic programme; a and b are short words.
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {

        const curr = [i];

        for (let j = 1; j <= b.length; j++) {

            curr[j] = Math.min(

                prev[j] + 1,                                   // deletion
                curr[j - 1] + 1,                               // insertion
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)  // substitution

            );

        }

        prev = curr;

    }

    return prev[b.length];

}

// Short words tolerate one edit, longer words two. Anything looser starts
// "correcting" words into unrelated ones.
function editBudget(word) {

    if (word.length <= 3) return 0;

    if (word.length <= 5) return 1;

    return 2;

}

// "bolts", "readings" and "cracks" are one edit away from "bolt", "reading"
// and "crack", so without this guard the fuzzy pass would strip plurals and
// tenses off perfectly good words. Treat a word as known when its stem is.
function isKnownWord(word) {

    if (KNOWN_WORDS.has(word)) return true;

    const stems = [];

    if (word.endsWith("es")) stems.push(word.slice(0, -2));
    if (word.endsWith("s")) stems.push(word.slice(0, -1));
    if (word.endsWith("ed")) stems.push(word.slice(0, -2), word.slice(0, -1));
    if (word.endsWith("ing")) stems.push(word.slice(0, -3), word.slice(0, -3) + "e");

    return stems.some((stem) => KNOWN_WORDS.has(stem));

}

// Words that assert whether something IS or IS NOT there. Guessing one of these
// from a near-miss inverts the meaning of the sentence: "water ulla" (water got
// inside) is one edit from "illa" and was being turned into "water not present" -
// the opposite of what the tester wrote, in a report that records a real result.
// These must only ever come from an EXACT dictionary match, never from fuzzy.
const MEANING_CRITICAL = /^(not present|is present|is not present|no |none|absent|present)$/i;

function fuzzyCorrect(word) {

    const budget = editBudget(word);

    if (!budget) return word;

    let best = null;
    let bestDistance = budget + 1;

    for (const [candidate, replacement] of FUZZY_CANDIDATES) {

        // Cheap length filter before the expensive distance computation.
        if (Math.abs(candidate.length - word.length) > budget) continue;

        // Never GUESS a presence/absence word - only an exact match may produce one.
        if (MEANING_CRITICAL.test(String(replacement).trim())) continue;

        const distance = levenshtein(word, candidate);

        if (distance < bestDistance) {

            bestDistance = distance;
            best = replacement;

            if (distance === 1) break;   // good enough, stop searching

        }

    }

    return best !== null && bestDistance <= budget ? best : word;

}

// Walks the words of a line, leaving punctuation, numbers and units intact.
function correctSpelling(text) {

    return text.replace(/[A-Za-z]+/g, (word, at, whole) => {

        // Units and codes keep their exact case: "48V", "200 mA", "5 kW", "IPX7".
        // Lower-casing them turned mA (milliamp) into "ma".
        const prev = whole.slice(Math.max(0, at - 2), at);
        if (/\d\s?$/.test(prev) &&
            /^(v|mv|kv|a|ma|ka|w|kw|mw|wh|kwh|ah|mah|hz|khz|nm|n|kn|mm|cm|m|km|kg|g|mg|s|ms|sec|secs|min|mins|h|hr|hrs|rpm|bar|kpa|mpa|psi|c|degc|k|db|dba|lux|ohm|ohms|mohm|kohm|l|ml|pcs|nos|x|v?dc|v?ac|ipx?)$/i.test(word)) return word;
        if (/[A-Z]/.test(word.slice(1))) return word;

        const lower = word.toLowerCase();

        // Explicit lists win over the stem check, so "gearbox" still splits.
        if (SPELLING[lower]) return SPELLING[lower];

        if (isKnownWord(lower)) return word;

        if (TANGLISH_WORDS[lower]) return TANGLISH_WORDS[lower];

        return fuzzyCorrect(lower);

    });

}

function correctSentenceCase(text) {

    // Capitalise the first letter of every sentence.
    return text.replace(

        /(^\s*|[.!?]\s+)([a-z])/g,

        (_, prefix, letter) => prefix + letter.toUpperCase()

    );

}

function applyTechnicalTerms(text) {

    TECHNICAL_TERMS.forEach((term) => {

        text = text.replace(new RegExp("\\b" + term + "\\b", "gi"), term);

    });

    return text;

}

function correctLine(line) {

    let txt = line.replace(/\s+/g, " ").trim();

    if (!txt) return "";

    // 1. Multi-word Tanglish phrases, before anything splits them up.
    TANGLISH_PHRASES.forEach(([pattern, replacement]) => {

        txt = txt.replace(pattern, replacement);

    });

    // 2. Exact word lookups, then fuzzy matching for everything unknown.
    txt = correctSpelling(txt);

    // 3. Grammar tidy-up on the resulting English.
    GRAMMAR_RULES.forEach(([pattern, replacement]) => {

        txt = txt.replace(pattern, replacement);

    });

    txt = txt.replace(/\s+/g, " ").trim();

    if (!/[.!?]$/.test(txt)) {

        txt += ".";

    }

    txt = correctSentenceCase(txt);

    return applyTechnicalTerms(txt);

}

// ---------- CORRECT ENGLISH (Observation) ----------
// Online, the observation goes to the AI, which UNDERSTANDS Tanglish, shorthand
// and broken English and returns correct, simple English as short points. The
// Tanglish dictionary below can only swap words it already knows, so it could
// not make sense of a real sentence - it is now the offline / busy fallback.

// The built-in, rule-based correction (no internet needed).
function correctLinesOffline(source) {
    return String(source || "").split(/\r?\n/).map(correctLine).filter((line) => line.length);
}

// Every number the engineer typed. A rewrite that loses one is not used.
function obsNumbers(s) {
    return String(s || "").match(/\d+(?:[.,]\d+)?/g) || [];
}

function parseObsPoints(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
    const marker = /^([-*•–]|\d+[.)])\s+/;
    let pts = lines.filter((l) => marker.test(l)).map((l) => l.replace(marker, ""));
    // No bullets came back: use the lines themselves, minus any chatty lead-in.
    if (!pts.length) pts = lines.filter((l) => !/^(here|sure|corrected|observation\s*:?\s*$)/i.test(l));
    return pts.map((p) => {
        p = p.replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
        if (p && !/[.!?]$/.test(p)) p += ".";
        return p.charAt(0).toUpperCase() + p.slice(1);
    }).filter((p) => p.length > 1);
}

function obsPointsHtml(points) {
    const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return '<ul class="obs-points">' + points.map((p) => "<li>" + esc(p) + "</li>").join("") + "</ul>";
}

function obsCorrectButton() {
    return document.querySelector('#observationCard .auto-btn[onclick^="correctObservation"]');
}

async function correctObservation(btn) {

    const el = document.getElementById("observation");
    const button = btn || obsCorrectButton();

    if (pvtPdfBusy()) return;
    if (button && button.disabled) return;            // already correcting

    // Pressed again straight after a correction: put the original text back.
    if (button && button.dataset.undo != null) {
        el.innerHTML = button.dataset.undo;
        delete button.dataset.undo;
        button.textContent = "Correct English";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        checkPageFit();
        return;
    }

    const source = el.innerText.trim();

    if (!source) {
        alert("Please type the observation first.");
        return;
    }

    const before = el.innerHTML;
    let points = null;
    let why = "";

    if (navigator.onLine && typeof aiComplete === "function") {

        if (button) { button.disabled = true; button.textContent = "Correcting…"; }
        // The box is read-only while the AI rewrites it: anything typed in the
        // meantime would be overwritten by the answer.
        obsCorrecting = true;
        const gen = obsGen;

        const system =
            "You are a technical editor for automotive and electric-vehicle (EV) test reports. You fully " +
            "understand Tanglish (Tamil written in English letters, mixed with English), Hinglish, " +
            "shorthand and broken English, and you rewrite it as clear, correct English.";

        const prompt =
            "Rewrite this test OBSERVATION, written by a test engineer, as correct and meaningful English " +
            "for a formal test report.\n\n" +
            "Rules:\n" +
            "- Understand the meaning first. Translate any Tanglish / Tamil words and fix grammar and spelling.\n" +
            "- Output ONLY short bullet points, one per line, each starting with \"- \".\n" +
            "- One fact per point, simple words, at most 20 words per point.\n" +
            "- Keep EVERY number, unit, part name, test name and result exactly as written " +
            "(for example 30 min, 48 V, 65 °C, IPX7).\n" +
            "- Do NOT add anything that is not in the text. Do not guess causes or give advice.\n" +
            "- No heading, no introduction, no closing sentence.\n\n" +
            "Observation:\n" + source;

        try {
            const reply = await aiComplete(prompt, system, false, null, 45000);
            const got = parseObsPoints(reply);
            // Whole numbers, not substrings: "5" is not kept just because "15" is.
            const kept = obsNumbers(got.join(" "));
            const missing = obsNumbers(source).filter((n) => kept.indexOf(n) < 0);
            if (!got.length) why = "empty";
            else if (missing.length) why = "value " + missing.slice(0, 3).join(", ");
            else points = got;
        } catch (e) {
            why = "busy";
        } finally {
            obsCorrecting = false;
            if (button) { button.disabled = false; button.textContent = "Correct English"; }
        }

        // The report changed underneath (Load Draft, New Report): this answer
        // belongs to text that is no longer there.
        if (gen !== obsGen || el.innerHTML !== before) return;

    } else {
        why = "offline";
    }

    if (!points) {
        points = correctLinesOffline(source);
        alert(
            why === "offline"
                ? "You are offline, so the built-in corrector was used. It only fixes common Tanglish words and spelling - connect to the internet for a full rewrite into correct English."
            : why === "busy"
                ? "The online AI is busy right now, so the built-in corrector was used (it only fixes common words). Press Correct English again in a minute for a full rewrite."
            : why === "empty"
                ? "The online AI gave no usable answer, so the built-in corrector was used. Press Correct English again for a full rewrite."
                : "The AI's rewrite dropped or changed a value (" + why.replace(/^value /, "") + "), so it was NOT used - the built-in corrector was used instead, keeping every value you typed."
        );
    }

    el.innerHTML = obsPointsHtml(points);

    if (button) { button.dataset.undo = before; button.textContent = "↶ Undo"; }

    el.dispatchEvent(new Event("input", { bubbles: true }));   // autosave

    checkPageFit();

}

// Typing in the Observation again ends the "Undo" offer - the undo would now
// throw away what was just typed.
(function () {
    const el = document.getElementById("observation");
    if (!el) return;
    // Read-only while the AI rewrites it: typing then would be overwritten.
    el.addEventListener("beforeinput", (e) => { if (obsCorrecting) e.preventDefault(); });
    el.addEventListener("paste", (e) => { if (obsCorrecting) e.preventDefault(); }, true);
    el.addEventListener("drop", (e) => { if (obsCorrecting) e.preventDefault(); }, true);
    el.addEventListener("input", (e) => {
        if (!e.isTrusted) return;          // our own autosave nudge, not typing
        const b = obsCorrectButton();
        if (b && b.dataset.undo != null) { delete b.dataset.undo; b.textContent = "Correct English"; }
    });
})();

// ===========================================
// AUTO CONCLUSION
// ===========================================

// The conclusion states which test was run, what was observed, and what that
// means for the product - the shape used in the reference reports:
//
//   "Based on the conducted in-house IPX7 test, water ingress was observed
//    during the testing process, resulting in motor failure. Therefore, the
//    motor is not suitable for its intended application."
//
// {t} test name, {r} reason clause from the template, {n} product noun.
const CONCLUSION_TEXT = {

    PASS: [

        `Based on the conducted in-house {t} test, {r}. Therefore, the {n} is ` +
        `suitable for its intended application.`,

        `From the results of the in-house {t} test, {r}. The {n} therefore meets ` +
        `the acceptance criteria and is suitable for its intended application.`,

        `The in-house {t} test was completed and {r}. Accordingly, the {n} complies ` +
        `with the specified requirements and is recommended for approval.`

    ],

    FAIL: [

        `Based on the conducted in-house {t} test, {r}. Therefore, the {n} is not ` +
        `suitable for its intended application.`,

        `From the results of the in-house {t} test, {r}. The {n} therefore does not ` +
        `meet the acceptance criteria and cannot be approved in its present form.`,

        `The in-house {t} test was completed and {r}. Accordingly, the {n} is not ` +
        `suitable for its intended application, and corrective action followed by a ` +
        `repeat test is required.`

    ]

};

// Set once the user types into the conclusion, so the Pass/Fail buttons never
// silently discard their wording.
let conclusionEdited = false;

document.getElementById("conclusion").addEventListener("input", () => {

    conclusionEdited = true;

});

// Writes the conclusion for the given result ("PASS" or "FAIL"), stepping to
// the next wording each time.
function writeConclusion(result){

    const variants = CONCLUSION_TEXT[result];

    const shell = nextVariant(result, variants);

    const test = document.getElementById("testName").innerText.trim();

    const product = document.getElementById("product").innerText.trim();

    const template = pickProcedure(test);

    const noun = productNoun(product);

    const reason = (result === "PASS" ? template.reasonPass : template.reasonFail)
        .replace(/\{n\}/g, noun);

    document.getElementById("conclusion").innerText = shell
        .replace(/\{t\}/g, testLabel(test) || "validation")
        .replace(/\{r\}/g, reason)
        .replace(/\{n\}/g, noun);

    conclusionEdited = false;

    checkPageFit();

}

// The Pass / Fail buttons in the Conclusion header. Each press regenerates the
// text; a manual edit is only replaced after confirming.
function autoConclusion(result){

    const conclusion = document.getElementById("conclusion");

    const hasText = conclusion.innerText.trim().length > 0;

    if (conclusionEdited && hasText) {

        const keep = !confirm(
            "Replace your edited conclusion with the standard " +
            result + " wording?"
        );

        if (keep) return;

    }

    writeConclusion(result);

}

// ===========================================
// NEW REPORT
// ===========================================

document.getElementById("newReport").addEventListener("click", newReport);

function newReport(){

    if (pvtPdfBusy()) return;

    const confirmed = confirm(
        "Start a new blank report? This clears every field and the saved draft."
    );

    if (!confirmed) return;

    clearObsUndo();

    // Back to the two built-in pages.
    removeAllAddedPages();

    // The report's fields only - not the RCA report or the test-case procedure.
    report.querySelectorAll("[contenteditable='true']").forEach((item) => {

        item.innerHTML = "";

        item.classList.remove("invalid");

    });

    resultTables.innerHTML = RESULT_TABLE_BLOCK;

    // A new report starts with every section in one plain column again.
    COLUMN_BOXES.forEach((id) => setColumns(id, 1));
    try { localStorage.removeItem("reportCols"); localStorage.removeItem("procedureCols"); } catch (e) { /* ignore */ }

    [beforePreview, afterPreview].forEach((img) => {

        img.removeAttribute("src");

        img.style.display = "none";

    });

    beforePlaceholder.style.display = "";

    afterPlaceholder.style.display = "";

    photoClear("before");

    photoClear("after");

    photoLabels["before"] = [];
    photoLabels["after"] = [];
    renderPhotoLabels("before");
    renderPhotoLabels("after");

    resetCrop("before");

    resetCrop("after");

    resetLogoCrop();

    companyLogo.src = "assets/placeholder.png";


    document.getElementById("extraPhotos").innerHTML = "";
    document.getElementById("extraPhotoCard").style.display = "none";
    extraPhotoSeq = 0;

    // The per-photo caches are read BEFORE storage (photoIsGray / marksInside),
    // so leaving them set made the next photo uploaded into a brand-new report
    // come back grey, or refuse to clamp its marks, with nothing in the (now
    // empty) storage to explain it. Selections and tool/pan/crop modes would
    // also have pointed at boxes that no longer exist.
    [photoGray, photoInside, photoSel, photoActiveTool, photoCropMode, photoRectMode]
        .forEach((store) => Object.keys(store).forEach((k) => { delete store[k]; }));
    photoActiveTool.before = null; photoActiveTool.after = null;
    lastPhotoId = null;

    // A drawing tool left ON kept its canvas capturing the mouse on top of the
    // (now empty) upload box, so clicking it to upload did nothing - and its
    // button stayed highlighted. The removed extra photos' marks were also kept
    // in memory and came back on the next photo given the same id.
    ["before", "after"].forEach((id) => {
        const cv = photoCanvas(id);
        if (cv) { cv.style.pointerEvents = "none"; cv.style.cursor = ""; cv.style.zIndex = ""; }
        const area = document.getElementById(id + "Area");
        if (area) area.style.cursor = "";
    });
    document.querySelectorAll("#report .photo-toolbar .tool-active")
        .forEach((b) => b.classList.remove("tool-active"));
    [photoShapes, photoLabels].forEach((store) => Object.keys(store).forEach((k) => {
        if (/^extra/.test(k)) delete store[k];
    }));
    if (typeof photoCrop !== "undefined") Object.keys(photoCrop).forEach((k) => {
        if (/^extra/.test(k)) delete photoCrop[k];
    });

    // Clear the saved report, but keep everything that is not part of it: the
    // RCA library and form, the test-case page, the AI keys and chat, the theme
    // and the screen settings. It used to keep only five AI keys, so "New
    // Report" also deleted every saved RCA and the user's own Gemini/OpenRouter
    // keys.
    const aiKeep = {};

    NON_REPORT_KEYS.forEach((k) => {

        const v = localStorage.getItem(k);

        if (v !== null) aiKeep[k] = v;

    });

    localStorage.clear();

    Object.keys(aiKeep).forEach((k) => localStorage.setItem(k, aiKeep[k]));

    conclusionEdited = false;

    // Storage was just emptied for this blank report: it is the draft now.
    draftBound = true;

    // The Grey / Keep-inside checkboxes showed the old report's choices.
    ["before", "after"].forEach((id) => {
        const g = document.getElementById(id + "Gray"); if (g) g.checked = false;
        const ins = document.getElementById(id + "Inside"); if (ins) ins.checked = true;
        applyPhotoGray(id);
    });

    variantIndex.objective = -1;
    variantIndex.procedure = -1;
    variantIndex.PASS = -1;
    variantIndex.FAIL = -1;

    mirrorHeader();

    applyApprovalState();
    applyObservationState();

    checkPageFit();

}

// ===========================================
// MULTIPLE SAVED REPORTS
//
// Each saved report is a full snapshot of the report's localStorage (every
// field, table, photo, annotation, label and crop) kept under one name. The
// AI settings/history and the saved-reports index itself are never part of a
// snapshot. Opening a report swaps localStorage and reloads, so all the normal
// restore code runs exactly as on a fresh visit.
// ===========================================

// Stored data that does NOT belong to a test report. It is never put into a
// saved report, never replaced when one is opened, and survives New Report.
// (Only the AI keys used to be listed, so each saved report also carried a
// copy of the RCA library, the theme and the AI keys - and opening an old
// report put those old copies back, losing RCAs saved since.)
const NON_REPORT_KEYS = [
    "aiKey", "aiModel", "aiProvider", "aiHistory",
    "aiGeminiKey", "aiGeminiModel", "aiOpenRouterKey", "aiOpenRouterModel", "openRouterKey",
    "savedReports", "savedRcas", "rcaState", "rcaLogo", "rcaLogoCrop", "tcState",
    "uiTheme", "currentView", "gotoViewOnce", "loadDraftOnce", "sup8dMode",
    "reportWatermark", "reportZoom", "rcaZoom"
];
const AI_KEYS = NON_REPORT_KEYS;
const SAVED_KEY = "savedReports";

function reportSnapshot() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === SAVED_KEY || AI_KEYS.indexOf(k) >= 0) continue;
        data[k] = localStorage.getItem(k);
    }
    return data;
}

function getSavedReports() {
    try {
        const list = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
        return Array.isArray(list) ? list : [];     // a corrupt value must not break My Reports
    }
    catch (e) { return []; }
}

function setSavedReports(list) {
    try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        alert("Storage is full - could not save. Delete an old report or remove some photos, then try again.");
        return false;
    }
}

// The app starts blank while the last draft stays in storage (for Load Draft).
// Its photos are only written when a photo is uploaded, so a report filled in
// from blank and saved used to carry the OLD draft's photos in its snapshot -
// opening it later showed pictures that were never on screen. Keep only the
// photo data of photos that are actually showing.
const PHOTO_KEY_SUFFIXES = ["Photo", "Annot", "Crop", "Labels", "Gray", "Inside"];

function pruneOffscreenPhotos(data) {
    const showing = (id) => {
        const img = document.getElementById(id + "Preview");
        return !!(img && img.getAttribute("src") && img.style.display !== "none");
    };
    const onScreenExtras = Array.prototype.map.call(
        document.querySelectorAll("#extraPhotos .photo-box[data-extra]"),
        (b) => b.getAttribute("data-extra"));
    Object.keys(data).forEach((k) => {
        const m = k.match(/^(before|after|extra\d+)(Photo|Annot|Crop|Labels|Gray|Inside)$/);
        if (!m) return;
        const id = m[1];
        // An added photo box that is on screen but EMPTY has no photo to keep.
        const keep = /^extra/.test(id) ? (onScreenExtras.indexOf(id) >= 0 && showing(id)) : showing(id);
        if (!keep) delete data[k];
    });
    if (!onScreenExtras.length) delete data.extraPhotosHTML;
    // The logo too: a placeholder on screen means no logo in this report.
    const logoEl = document.getElementById("companyLogo");
    if (logoEl && /placeholder/i.test(logoEl.getAttribute("src") || "")) { delete data.companyLogo; delete data.logoCrop; }
    return data;
}

// A PDF being built renders the report as it is right now; saving, loading or
// clearing it in the middle changes what gets printed.
function pvtPdfBusy() {
    if (pdfBuilding || pdfStraggler) {
        alert("Please wait - the PDF is still being made. Try again when it has finished.");
        return true;
    }
    return false;
}

// Ends the "↶ Undo" offer of Correct English (the text it would put back
// belongs to a report that is no longer on screen).
let obsCorrecting = false;   // the AI is rewriting the Observation right now
let obsGen = 0;              // bumped when the report on screen is replaced

function clearObsUndo() {
    obsGen++;
    const b =typeof obsCorrectButton === "function" ? obsCorrectButton() : null;
    if (b && b.dataset.undo != null) { delete b.dataset.undo; b.textContent = "Correct English"; }
}

function saveCurrentReport() {

    if (pvtPdfBusy()) return;

    // flush the latest typed values into localStorage
    try { saveAll(); }
    catch (e) {
        alert("The browser storage is full, so the report could not be saved.\n\nDelete old reports in My Reports, or remove some photos, then try again.");
        return;
    }

    const appr = document.querySelector(".approval-table");
    if (appr) localStorage.setItem("approvalTable", appr.innerHTML);

    const reportNo = (document.getElementById("reportNo").innerText || "").trim();
    const product = (document.getElementById("product").innerText || "").trim();
    const testName = (document.getElementById("testName").innerText || "").trim();

    // Ask for the name instead of silently using the Report No. Pre-fill with a
    // sensible suggestion so it is one keystroke to accept.
    const suggested = [reportNo, testName || product].filter(Boolean).join(" — ") || "Untitled report";
    const typed = prompt("Name this report:", suggested);
    if (typed === null) return;                       // cancelled
    const name = typed.trim() || suggested;

    const list = getSavedReports();

    let stamp;
    try { stamp = new Date().toLocaleString(); } catch (e) { stamp = ""; }

    // Same name -> update that entry instead of making a duplicate - but ASK
    // first. Accepting the pre-filled name (e.g. "Untitled report") silently
    // destroyed a different report saved under the same name.
    const existing = list.find((r) => r.name === name);

    if (existing && !confirm('A saved report called "' + name + '" already exists.\n\n' +
            "OK = replace it with the report on screen\nCancel = keep it (nothing is saved)")) return;

    if (existing) {
        existing.data = pruneOffscreenPhotos(reportSnapshot());
        existing.date = stamp;
    } else {
        list.unshift({ id: "r" + Date.now(), name: name, date: stamp, data: pruneOffscreenPhotos(reportSnapshot()) });
    }

    if (setSavedReports(list)) {
        renderReportList();
        alert("Saved: " + name);
    }
}

// Swap localStorage to this report's snapshot (keeping AI settings + the saved
// list). Separated from the reload so it can be tested on its own.
function applyReportSnapshot(entry) {

    const keep = {};
    NON_REPORT_KEYS.forEach((k) => {
        const v = localStorage.getItem(k);
        if (v !== null) keep[k] = v;
    });

    // Everything is written back after the clear. If the browser refuses a
    // write half way (storage full), the report would be part old and part new
    // with nothing said about it - so report the failure and let the caller
    // stop instead of reloading into a damaged report.
    // Everything currently stored, so a failed open can put it all back instead
    // of leaving the current draft deleted and half of the other report stored.
    const backup = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); backup[k] = localStorage.getItem(k); } }
    catch (e) { /* read failure - nothing to back up */ }

    try {
        localStorage.clear();
        Object.keys(keep).forEach((k) => localStorage.setItem(k, keep[k]));
        // Reports saved by older versions also hold RCA / AI / theme data: skip
        // those, so opening an old report never rolls them back.
        Object.keys(entry.data).forEach((k) => {
            if (NON_REPORT_KEYS.indexOf(k) < 0) localStorage.setItem(k, entry.data[k]);
        });
        return true;
    } catch (e) {
        // Put the previous contents back (they fitted before).
        try {
            localStorage.clear();
            Object.keys(backup).forEach((k) => localStorage.setItem(k, backup[k]));
        } catch (e2) { /* best effort */ }
        alert("Could not open that report - the browser storage is full.\n\n" +
            "Delete an old report in My Reports, or remove some photos, then try again.");
        return false;
    }
}

function openSavedReport(id) {

    if (pvtPdfBusy()) return;

    const list = getSavedReports();
    const entry = list.find((r) => r.id === id);
    if (!entry) return;

    if (!confirm('Open "' + entry.name + '"?\n\nThis replaces the report on screen - save it first if you need it.')) return;

    if (!applyReportSnapshot(entry)) return;

    // The reload below restarts the app, which always opens on Home - so the
    // report you just opened was never shown. Leave a one-shot marker telling
    // the next start to go straight to the report page.
    try {
        localStorage.setItem("gotoViewOnce", "pvt");
        // ...and to LOAD it. The app starts blank on purpose, so without this
        // the opened report showed as an empty form.
        localStorage.setItem("loadDraftOnce", "1");
    } catch (e) { /* ignore */ }

    // The report still on screen must not be saved over the one just opened.
    skipUnloadSave = true;

    // Reload so every restore routine runs exactly as on a fresh visit.
    location.reload();
}

function deleteSavedReport(id) {
    let list = getSavedReports();
    const entry = list.find((r) => r.id === id);
    if (entry && !confirm('Delete saved report "' + entry.name + '"?')) return;
    list = list.filter((r) => r.id !== id);
    setSavedReports(list);
    renderReportList();
}

function renderReportList() {

    const wrap = document.getElementById("reportsList");
    if (!wrap) return;

    const list = getSavedReports();

    if (!list.length) {
        wrap.innerHTML = '<p class="reports-empty">No saved reports yet. Fill a report, then press "Save the report on screen".</p>';
        return;
    }

    wrap.innerHTML = "";

    list.forEach((r) => {

        const row = document.createElement("div");
        row.className = "reports-row";

        const info = document.createElement("div");
        info.className = "reports-info";
        const nm = document.createElement("b");
        nm.textContent = r.name;
        const dt = document.createElement("span");
        dt.className = "reports-date";
        dt.textContent = r.date || "";
        info.appendChild(nm);
        info.appendChild(dt);
        row.appendChild(info);

        const open = document.createElement("button");
        open.type = "button";
        open.className = "reports-open";
        open.textContent = "Open";
        open.addEventListener("click", () => openSavedReport(r.id));
        row.appendChild(open);

        const ren = document.createElement("button");
        ren.type = "button";
        ren.className = "reports-open reports-ren";
        ren.textContent = "Rename";
        ren.addEventListener("click", () => renameSavedReport(r.id));
        row.appendChild(ren);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "reports-del";
        del.textContent = "Delete";
        del.addEventListener("click", () => deleteSavedReport(r.id));
        row.appendChild(del);

        wrap.appendChild(row);

    });
}

// Lets a badly-named save (e.g. a stray Report No like "35464y") be corrected
// without having to open, re-fill and save it again.
function renameSavedReport(id) {
    const list = getSavedReports();
    const entry = list.find((r) => r.id === id);
    if (!entry) return;
    const typed = prompt("Rename this report:", entry.name);
    if (typed === null) return;
    const name = typed.trim();
    if (!name || name === entry.name) return;
    if (list.some((r) => r.id !== id && r.name === name)) {
        alert('There is already a saved report called "' + name + '". Please use a different name.');
        return;
    }
    entry.name = name;
    if (setSavedReports(list)) renderReportList();
}

function openReports() {
    renderReportList();
    document.getElementById("reportsModal").hidden = false;
}

function closeReports() {
    document.getElementById("reportsModal").hidden = true;
}

document.getElementById("myReports").addEventListener("click", openReports);
document.getElementById("reportsModal").addEventListener("click", (e) => {
    if (e.target.id === "reportsModal") closeReports();   // click backdrop to close
});

// ===========================================
// DASHBOARD NAVIGATION (front page + sidebar views)
// ===========================================

const VIEWS = ["home", "cases", "pvt", "rca", "supplier8d"];

function showView(name) {

    if (VIEWS.indexOf(name) < 0) name = "home";

    document.querySelectorAll(".view").forEach((v) => {
        v.hidden = (v.id !== "view-" + name);
    });

    document.querySelectorAll(".side-link").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-view") === name);
    });

    window.scrollTo(0, 0);

    try { localStorage.setItem("currentView", name); } catch (e) { /* ignore */ }

    // The report was hidden, so re-run the fit now that it is measurable.
    if (name === "pvt") { checkPageFit(); redrawAllPhotos(); }
}

// Photos restored by Load Draft / My Reports -> Open were framed and their marks
// drawn while the picture had not decoded yet (or the report was hidden), so the
// straighten zoom came out as 1 (blank corners) and zoom-box insets were missing
// - on screen and in the PDF. Redraw each photo once it can be measured.
function redrawPhotoWhenReady(id) {
    const pv = document.getElementById(id + "Preview");
    if (!pv || !pv.getAttribute("src") || pv.style.display === "none") return;
    const go = () => {
        if (!pv.isConnected) return;
        if (photoCrop[id]) applyCrop(id);
        redrawPhoto(id);
    };
    if (pv.complete && pv.naturalWidth) go();
    else pv.addEventListener("load", go, { once: true });
}

function redrawAllPhotos() {
    PHOTO_IDS.concat(Array.prototype.map.call(document.querySelectorAll("#extraPhotos .photo-box[data-extra]"),
        (b) => b.getAttribute("data-extra"))).forEach(redrawPhotoWhenReady);
}

// Any element with data-view navigates (sidebar links + home cards).
document.addEventListener("click", (e) => {
    const el = e.target.closest ? e.target.closest("[data-view]") : null;
    if (el) { e.preventDefault(); showView(el.getAttribute("data-view")); }
});


// ===========================================
// PRODUCT & TEST CASES
// Fetch a test's standard procedure online (via the chosen AI provider) and
// optionally keep the report's Test Procedure in sync with it.
// ===========================================

// Some models return their chain-of-thought or a JSON wrapper ({reasoning, ...})
// instead of plain text. Pull out just the final answer.
// The RCA/8D report keeps its OWN logo ("rcaLogo"), separate from the test
// report's company logo. If none has been set for the RCA, fall back to the
// company logo so nothing looks empty.
// Shown in the RCA report's logo slot until a logo is chosen. Screen only: the
// PDF, Word and View / Print leave it out.
const RCA_LOGO_PLACEHOLDER = '<span class="rca-logo-ph">🖼 Add logo</span>';

// "none" in rcaLogo = the user removed the logo from the RCA report: show no
// logo at all, and do NOT fall back to the test report's company logo.
const RCA_NO_LOGO = "none";

// What goes in the RCA report's logo slot: the logo with a ✕ to remove it, or
// the "Add logo" box. The ✕ and the box are screen-only (never exported).
// How the RCA logo is panned / zoomed inside its box, like the test report's
// "Adjust" on the company logo. Kept separately from the test report's logoCrop.
let rcaLogoCrop = { scale: 1, x: 0, y: 0 };
let rcaLogoCropMode = false;

function rcaLogoCropLoad() {
    try {
        const s = localStorage.getItem("rcaLogoCrop");
        if (s) rcaLogoCrop = Object.assign({ scale: 1, x: 0, y: 0 }, JSON.parse(s));
    } catch (e) { /* keep the default */ }
    return rcaLogoCrop;
}

function rcaLogoCropSave() {
    try { localStorage.setItem("rcaLogoCrop", JSON.stringify(rcaLogoCrop)); } catch (e) { /* storage full */ }
}

// The transform travels in the markup itself: the report HTML is rebuilt on
// every render, and the PDF / View-Print copy that HTML, so an inline style is
// the only thing that reaches all of them.
function rcaLogoCropStyle() {
    const c = rcaLogoCrop;
    return "transform:translate(" + (c.x || 0) + "px," + (c.y || 0) + "px) scale(" + (c.scale || 1) + ");transform-origin:center center;";
}

function rcaLogoMarkup(url) {
    return url
        ? '<span class="rca-logo-box"><img class="rca-doc-logo8d" style="' + rcaLogoCropStyle() + '" src="' + url + '" alt=""></span>' +
          '<button type="button" class="rca-logo-x" title="Remove the logo from the RCA report" aria-label="Remove logo">✕</button>' +
          '<button type="button" class="rca-logo-adjust" title="Drag to move, scroll to zoom, double-click to reset">⤢ Adjust</button>'
        : RCA_LOGO_PLACEHOLDER;
}

// Redraws the logo with the crop baked in, at the size of its box - Word has no
// CSS transform, so the picture itself must already be panned / zoomed.
function rcaLogoBaked(boxW, boxH) {
    const url = rcaLogoData();
    if (!url || url.indexOf("data:image") !== 0) return Promise.resolve(null);
    const c = rcaLogoCrop, k = 4;                     // 4x for a sharp picture in Word
    const W = (boxW || 150), H = (boxH || 44);
    return new Promise((resolve) => {
        const im = new Image();
        im.onload = () => {
            try {
                const cv = document.createElement("canvas");
                cv.width = W * k; cv.height = H * k;
                const g = cv.getContext("2d");
                g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
                // object-fit: contain, then the same translate + scale about the centre
                const iw = im.naturalWidth || W, ih = im.naturalHeight || H;
                const fit = Math.min(W / iw, H / ih);
                const s = fit * (c.scale || 1) * k;
                const dw = iw * s, dh = ih * s;
                g.drawImage(im, (cv.width - dw) / 2 + (c.x || 0) * k, (cv.height - dh) / 2 + (c.y || 0) * k, dw, dh);
                resolve({ url: cv.toDataURL("image/png"), w: cv.width, h: cv.height });
            } catch (e) { resolve(null); }
        };
        im.onerror = () => resolve(null);
        im.src = url;
    });
}

function rcaLogoData() {
    try {
        const own = localStorage.getItem("rcaLogo");
        if (own === RCA_NO_LOGO) return "";
        if (own && own.indexOf("data:") === 0) return own;
        const shared = localStorage.getItem("companyLogo");
        return (shared && shared.indexOf("data:") === 0) ? shared : "";
    } catch (e) { return ""; }
}

function cleanAIText(raw) {
    let t = String(raw == null ? "" : raw).trim();

    // Drop <think>...</think> reasoning blocks.
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // If it's a JSON object/array (a reasoning/response wrapper), extract the
    // actual answer text from the usual fields.
    if (t.charAt(0) === "{" || t.charAt(0) === "[") {
        try {
            const o = JSON.parse(t);
            const pick = (x) => x && (
                (typeof x.content === "string" && x.content) ||
                (typeof x.text === "string" && x.text) ||
                (x.message && x.message.content) ||
                (x.choices && x.choices[0] && (x.choices[0].message ? x.choices[0].message.content : x.choices[0].text))
            );
            let c = pick(o);
            if (!c && Array.isArray(o) && o.length) c = pick(o[o.length - 1]);
            if (c) return String(c).trim();
        } catch (e) { /* fall through to regex below */ }

        // Malformed / truncated / streamed JSON: pull the "content" string out.
        const cm = t.match(/"content"\s*:\s*"((?:\\.|[^"\\])*)"/);
        if (cm && cm[1]) {
            return cm[1].replace(/\\n/g, "\n").replace(/\\t/g, " ")
                .replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
        }
    }

    // Last resort: if a reasoning dump still precedes the answer, keep only from
    // the first "Standard:" line or the first numbered step onward.
    if (/\breasoning\b/i.test(t.slice(0, 40)) || t.charAt(0) === "{") {
        const idx = t.search(/(^|\n)\s*standard\s*[:\-]/i);
        const idx2 = t.search(/(^|\n)\s*1[.)]\s/);
        const cut = (idx >= 0) ? idx : idx2;
        if (cut >= 0) return t.slice(cut).replace(/^[\s\n]+/, "").trim();
    }

    return t;
}

// Stateless single-prompt AI call (no chat history). Uses whichever provider
// the AI panel is set to: free (Pollinations), Google Gemini, or OpenAI.
// `images` (optional) is an array of data-URL strings. Gemini and OpenAI analyse
// them (vision); the free backend ignores them (text only).

// OpenRouter free access (uses the built-in key). These NVIDIA Nemotron :free
// models were verified working; they are tried in order and the first that
// answers wins (individual free models get rate-limited). NOTE: this key sits
// in this file - if you share the folder or a backup, rotate it at openrouter.ai.
const OPENROUTER_KEY = "";
// Built-in Google Gemini key. NOTE: this sits in plain text in this file - anyone
// with a copy of the folder (or a backup/zip of it) has the key. Rotate it in
// Google AI Studio if this project is ever shared or published.
// A key entered in Ask AI -> settings always overrides this one.
const GEMINI_KEY = "";
// gemini-2.5-flash, NOT 2.0: this project has no free-tier quota on the 2.0
// models (the API answers 429 "limit: 0"), but 2.5-flash works. Verified against
// the live API. It also reads images, which is what the photo feature needs.
const GEMINI_MODEL = "gemini-2.5-flash";

// Text from a file's bytes: UTF-8, or the Windows code page that Excel and
// Notepad often save in (reading everything as UTF-8 turned "°C" into "�C").
function decodeTextFile(buf) {
    const bytes = new Uint8Array(buf);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, ""); }
    catch (e) {
        try { return new TextDecoder("windows-1252").decode(bytes); }
        catch (e2) { return new TextDecoder("latin1").decode(bytes); }
    }
}

// &lt; &#x2019; &deg; ... back to their characters. &amp; goes LAST, so text
// that really says "&lt;" (stored as "&amp;lt;") is not decoded twice.
function decodeEntities(t) {
    const named = {
        lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", plusmn: "±", micro: "µ",
        times: "×", divide: "÷", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“",
        rdquo: "”", hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™",
        euro: "€", pound: "£", sup2: "²", sup3: "³", frac12: "½", frac14: "¼", le: "≤", ge: "≥",
        ne: "≠", asymp: "≈", Omega: "Ω", omega: "ω", mu: "μ", alpha: "α", beta: "β", Delta: "Δ", delta: "δ"
    };
    return String(t)
        .replace(/&#x([0-9a-f]+);/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return m; } })
        .replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch (e) { return m; } })
        .replace(/&([A-Za-z][A-Za-z0-9]*);/g, (m, n) => (n !== "amp" && named[n] !== undefined) ? named[n] : m)
        .replace(/&amp;/g, "&");
}

// A time limit for one AI request. Without one, a connection that stalls
// (rather than failing) left the chat or button stuck on "busy" for ever; with
// it the request fails and the next service / built-in answer takes over.
function aiSignal(ms) {
    const limit = ms || 45000;
    try {
        if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) return AbortSignal.timeout(limit);
    } catch (e) { /* fall through to the manual timer below */ }
    // Older browsers / WebViews have no AbortSignal.timeout. Returning nothing
    // left those calls with NO time limit at all: a stalled request then kept
    // "Assistant is typing…" on screen with Send disabled until a reload.
    try {
        const ac = new AbortController();
        setTimeout(() => { try { ac.abort(); } catch (e2) { /* already finished */ } }, limit);
        return ac.signal;
    } catch (e) { return undefined; }
}

// One Gemini call. Returns the text, or null so the caller can fall through to
// the other free backends instead of failing outright.
// ---- Server-side keys (hosted copy, e.g. Netlify) ----
// The published site carries NO keys in its files. When there is no key in the
// browser (none typed in settings, no built-in one) and the app is served over
// http(s), requests go to the site's own function at /api/ai, which adds the key
// kept as a secret on the server. Opened as a local file, nothing changes.
const AI_PROXY_PATH = "/api/ai";
// Hosted over http(s): mark the page so the layout can make room for the host's badge.
try { if (/^https?:$/.test(location.protocol)) document.documentElement.classList.add("is-hosted"); } catch (e) { /* ignore */ }
// Whether this site actually HAS the relay: true on Netlify, false on a plain
// static host such as GitHub Pages, where every call would only 404 before the
// app falls back to the free services. Asked once, then remembered.
let aiProxyOk = null;
function aiProxyUsable() {
    try { return /^https?:$/.test(location.protocol) && aiProxyOk !== false; } catch (e) { return false; }
}
async function checkAiProxy() {
    if (aiProxyOk !== null) return aiProxyOk;
    try {
        if (!/^https?:$/.test(location.protocol)) { aiProxyOk = false; return false; }
        const r = await fetch(AI_PROXY_PATH, { method: "GET" });
        const j = r.ok ? await r.json() : null;
        aiProxyOk = !!(j && j.ok && (j.gemini || j.openrouter));
    } catch (e) { aiProxyOk = false; }
    return aiProxyOk;
}
// Ask once at start-up, so the first AI request already knows the answer.
try { if (/^https?:$/.test(location.protocol)) checkAiProxy(); } catch (e) { /* ignore */ }
function geminiFetch(model, key, payload, signal) {
    if (key) {
        return fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify(payload),
            signal: signal
        });
    }
    if (!aiProxyUsable()) return Promise.resolve(null);
    return fetch(AI_PROXY_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "gemini", model: model, payload: payload }),
        signal: signal
    });
}
function openRouterFetch(key, payload, signal) {
    if (key) {
        return fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
                "HTTP-Referer": (aiProxyUsable() && location.origin) || "https://bncmotors.local",
                "X-Title": "BNC EV Testing and Validation"
            },
            body: JSON.stringify(payload),
            signal: signal
        });
    }
    if (!aiProxyUsable()) return Promise.resolve(null);
    return fetch(AI_PROXY_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "openrouter", payload: payload }),
        signal: signal
    });
}

async function geminiChat(prompt, sys, imgs, key, timeoutMs) {
    if (!key && !aiProxyUsable()) return null;
    const parts = [{ text: prompt }];
    (imgs || []).forEach((u) => {
        const comma = u.indexOf(",");
        const mime = (u.slice(5, u.indexOf(";")) || "image/jpeg");
        parts.push({ inlineData: { mimeType: mime, data: u.slice(comma + 1) } });
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 45000);
    try {
        // Only the Gemini model box - "aiModel" is the OpenAI model (e.g. gpt-4o-mini),
        // which Gemini does not have.
        const model = ((localStorage.getItem("aiGeminiModel") || "").trim() || GEMINI_MODEL);
        // The key goes in a HEADER, never in the URL. A query string is written
        // to the browser's network log, to history, and to any corporate proxy's
        // access log - places a header never reaches.
        const res = await geminiFetch(model, key, {
                system_instruction: { parts: [{ text: sys }] },
                contents: [{ role: "user", parts: parts }],
                generationConfig: { temperature: 0.2 }
            }, ctrl.signal);
        clearTimeout(timer);
        if (!res || !res.ok) return null;
        const data = await res.json();
        const rparts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
        const txt = cleanAIText(rparts.map((p) => p.text || "").join(""));
        return txt || null;
    } catch (e) { clearTimeout(timer); return null; }
}
const OPENROUTER_MODELS = [
    "nvidia/nemotron-3-super-120b-a12b:free",   // fast + capable -> primary (good speed)
    "nvidia/nemotron-3-ultra-550b-a55b:free",   // most capable -> fallback (slower)
    "nvidia/nemotron-nano-12b-v2-vl:free"       // last resort / vision
];
// Several free vision models, tried in order. Only ONE was listed before, so when
// it answered 402 (free quota used up) or 429 (rate limited) the whole photo
// feature failed with nothing to fall back on - which is exactly what the
// "free assistant is busy (402)" error was. Free tiers are per-model, so another
// model on the list normally still answers.
// Free models on OpenRouter that actually accept an IMAGE. This list goes stale:
// the previous six (nemotron-nano-12b-v2-vl, qwen2.5-vl-72b/32b, llama-3.2-11b-
// vision, gemma-3-27b, mistral-small-3.2) are no longer free vision models, so
// every photo/scanned-PDF request answered 402 and the feature looked broken.
// Verified against the live model list, first two confirmed reading an image:
const OPENROUTER_VISION_MODELS = [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",   // verified OK
    "dots-studio/dots-3-note-preview:free",                 // verified OK
    "google/gemma-4-31b-it:free",                           // rate-limited when tested
    "google/gemma-4-26b-a4b-it:free",
    "thinkingmachines/inkling-small:free"
];
const OPENROUTER_VISION_MODEL = OPENROUTER_VISION_MODELS[0];  // "vl" = sees images
// Shrink a photo before sending it to a vision model. A phone photo is often
// several MB, and base64 inflates it by a further ~33%, so the request body ends
// up enormous: slow to upload and frequently past the free model's limit, which
// made identification take ages and then come back empty. ~900px is plenty for
// recognising what a part is. Falls back to the original on any failure.
function shrinkImage(dataUrl, maxPx, quality) {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.onload = function () {
                let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
                if (!w || !h) { resolve(dataUrl); return; }
                const scale = Math.min(1, (maxPx || 900) / Math.max(w, h));
                w = Math.max(1, Math.round(w * scale));
                h = Math.max(1, Math.round(h * scale));
                const c = document.createElement("canvas");
                c.width = w; c.height = h;
                const ctx = c.getContext("2d");
                ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);   // flatten transparency for JPEG
                ctx.drawImage(img, 0, 0, w, h);
                try { resolve(c.toDataURL("image/jpeg", quality || 0.82)); }
                catch (e) { resolve(dataUrl); }
            };
            img.onerror = function () { resolve(dataUrl); };
            img.src = dataUrl;
        } catch (e) { resolve(dataUrl); }
    });
}

async function openRouterChat(messages, timeoutMs) {
    // A per-user key set in Ask AI -> settings overrides the built-in one.
    // "aiOpenRouterKey" is what the settings panel writes; "openRouterKey" is
    // kept for anyone who saved a key under the older name.
    let key = OPENROUTER_KEY;
    try {
        const k = (localStorage.getItem("aiOpenRouterKey") || localStorage.getItem("openRouterKey") || "").trim();
        if (k) key = k;
    } catch (e) { /* ignore */ }
    if (!key && !aiProxyUsable()) return null;
    // If any message carries an image, only the vision model can read it.
    const hasImage = messages.some((m) => Array.isArray(m.content) &&
        m.content.some((p) => p && p.type === "image_url"));
    let models = hasImage ? OPENROUTER_VISION_MODELS : OPENROUTER_MODELS;
    // A model named in settings is tried first, with the defaults still behind it.
    try {
        const pick = (localStorage.getItem("aiOpenRouterModel") || "").trim();
        if (pick && !hasImage) models = [pick].concat(models.filter((m) => m !== pick));
    } catch (e) { /* ignore */ }
    let timeouts = 0;
    for (let i = 0; i < models.length; i++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs || 45000);
        try {
            const res = await openRouterFetch(key, { model: models[i], messages: messages }, ctrl.signal);
            clearTimeout(timer);
            if (!res) return null;
            if (res.ok) {
                const data = await res.json();
                const txt = cleanAIText((((data.choices || [])[0] || {}).message || {}).content || "");
                if (txt) return txt;
            }
            // non-ok (429 / 404 / 5xx) -> try the next model quickly
        } catch (e) {
            clearTimeout(timer);
            // A model that STALLS (aborted) is expensive; don't keep waiting on
            // more slow models - after 2 timeouts, give up so nothing hangs.
            if (++timeouts >= 2) break;
        }
    }
    return null;
}

// Puter.js free AI (no API key). Returns the reply text, or null if it is
// unavailable / unusable. `allowPopup` lets it trigger Puter's one-time
// sign-in window; pass false for background calls (test cases / procedures /
// RCA) so nothing pops up unless the user has already signed in via settings.
async function puterChat(messages, allowPopup) {
    if (!(window.puter && window.puter.ai && typeof window.puter.ai.chat === "function")) return null;
    let signedIn = false;
    try { signedIn = !!(window.puter.auth && window.puter.auth.isSignedIn && window.puter.auth.isSignedIn()); } catch (e) { /* ignore */ }
    if (!signedIn && !allowPopup) return null;
    try {
        const r = await Promise.race([
            window.puter.ai.chat(messages),
            new Promise((_, rej) => setTimeout(() => rej(new Error("puter timeout")), 60000))
        ]);
        let txt = "";
        if (typeof r === "string") txt = r.trim();
        else if (r && r.message) {
            const c = r.message.content;
            if (typeof c === "string") txt = c.trim();
            else if (Array.isArray(c)) txt = c.map((p) => p.text || "").join("").trim();
        } else if (r && typeof r.text === "string") txt = r.text.trim();
        return txt || null;
    } catch (e) { return null; }
}

// requireVision: the answer is about the image itself (e.g. "what product is in
// this photo"). Then only services that can see images are used - the
// text-only fallbacks never receive the image, so they would invent an answer.
// Set by aiComplete when the provider the user CHOSE could not answer and the
// shared free services were used instead. The answer is still returned - but the
// caller must say so, because the text sent (a supplier's 8D report, the failure
// description) then went to a different service from the one the user picked.
let aiFellBackFrom = null;

async function aiComplete(prompt, system, forceFree, images, timeoutMs, requireVision) {

    const provider = forceFree ? "free" : (localStorage.getItem("aiProvider") || "free");

    if (!forceFree) aiFellBackFrom = null;

    // ONE time budget for the WHOLE chain, not one per service. Each backend
    // used to get the full timeout to itself, so a 90 s call could spend 90 s on
    // Gemini, then up to 2 x 90 s on OpenRouter, then Puter, then Pollinations
    // three times with back-off - minutes of "Evaluating…" that the user could
    // neither see the end of nor cancel. Now every service gets what is LEFT.
    const budget = timeoutMs || 45000;
    const deadline = Date.now() + budget;
    const left = () => deadline - Date.now();
    // Below ~2 s there is no point handing the request to another service.
    const spent = () => left() < 2000;
    const key = (localStorage.getItem("aiKey") || "").trim();
    const sys = system || "You are a helpful test-engineering assistant.";
    const imgs = Array.isArray(images) ? images.filter((u) => typeof u === "string" && u.indexOf("data:") === 0) : [];

    // "Prefer OpenRouter" - try it first, then fall through to the chain below.
    if (provider === "openrouter") {
        const visionUserOnly = imgs.length
            ? [{ type: "text", text: prompt }].concat(imgs.map((u) => ({ type: "image_url", image_url: { url: u } })))
            : prompt;
        const only = await openRouterChat(
            [{ role: "system", content: sys }, { role: "user", content: visionUserOnly }], left());
        if (only) return only;
        // fall through - Gemini and the rest still get a turn
    }

    // "Prefer Google Gemini" - try it first. If it fails (most often the daily
    // free quota, which on some projects is only 20 requests) fall THROUGH to the
    // shared chain below rather than throwing: a rate limit on one service must
    // not stop the feature when another one is available.
    // The user's Gemini key, else the built-in one - never the OpenAI key ("key"),
    // which would be sent to Google and rejected.
    if (provider === "gemini") {
        const gk = (localStorage.getItem("aiGeminiKey") || "").trim() || GEMINI_KEY;
        const only = await geminiChat(prompt, sys, imgs, gk, left());
        if (only) return only;
        // fall through to the free chain
    }

    if (provider === "openai" && key) {
        const model = (localStorage.getItem("aiModel") || "gpt-4o-mini").trim();
        const userContent = imgs.length
            ? [{ type: "text", text: prompt }].concat(imgs.map((u) => ({ type: "image_url", image_url: { url: u } })))
            : prompt;
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
            body: JSON.stringify({ model: model, messages: [{ role: "system", content: sys }, { role: "user", content: userContent }], temperature: 0.3 }),
            signal: aiSignal(left())
        });
        if (!res.ok) throw new Error("OpenAI error: " + res.status);
        const data = await res.json();
        return cleanAIText((((data.choices || [])[0] || {}).message || {}).content || "");
    }

    // Free backend priority, chosen by task after measuring both:
    //
    //   WITH AN IMAGE  -> Gemini first. It is the only free backend that reads
    //                     photos and scanned PDF pages reliably; the free
    //                     OpenRouter vision models are weak and often 402.
    //   TEXT ONLY      -> OpenRouter first. On the same prompt Nemotron Super
    //                     answered in 6.4s vs Gemini's 10.5s AND kept to the
    //                     requested format, where Gemini padded the answer.
    //                     It also saves the scarce Gemini quota for the image
    //                     work that only Gemini can do.
    //
    // Either way the other one is tried next, so nothing fails when one is out.
    // Everything below is the SHARED free chain. Reaching it with a provider
    // chosen means that provider failed (usually its daily quota), so record it:
    // the answer is still produced, but the caller has to tell the user which
    // service actually saw the text.
    if (!forceFree && provider !== "free") {
        aiFellBackFrom = provider === "gemini" ? "Google Gemini"
            : provider === "openrouter" ? "OpenRouter"
            : provider === "openai" ? "OpenAI" : provider;
    }

    const textMessages = [{ role: "system", content: sys }, { role: "user", content: prompt }];
    const visionUser = imgs.length
        ? [{ type: "text", text: prompt }].concat(imgs.map((u) => ({ type: "image_url", image_url: { url: u } })))
        : prompt;
    const orMessages = [{ role: "system", content: sys }, { role: "user", content: visionUser }];

    // Each service uses the user's own key when they have entered one in
    // Ask AI -> settings, otherwise the built-in key. They work TOGETHER: both
    // can be set at the same time and each backs the other up.
    const gKey = (localStorage.getItem("aiGeminiKey") || "").trim() || GEMINI_KEY;   // never the OpenAI key

    if (imgs.length) {
        const gv = await geminiChat(prompt, sys, imgs, gKey, left());
        if (gv) return gv;
        const orv = spent() ? null : await openRouterChat(orMessages, left());
        if (orv) return orv;
        if (requireVision) throw new Error("the online services that can read photos are busy right now");
    } else {
        const orv = await openRouterChat(orMessages, left());
        if (orv) return orv;   // already cleaned
        const gv = spent() ? null : await geminiChat(prompt, sys, imgs, gKey, left());
        if (gv) return gv;
    }

    const pv = spent() ? null : await puterChat(textMessages, false);   // Puter path is text-only
    if (pv) return cleanAIText(pv);

    // Otherwise the Pollinations community service (text only). Use a FAST,
    // non-reasoning model so it returns a clean answer. Rate-limited, so retry.
    const body = JSON.stringify({ model: "openai-fast", messages: textMessages });
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
        // Out of time: stop retrying rather than adding another wait on top of
        // everything the chain has already spent.
        if (spent()) { if (!lastStatus) lastStatus = "timed out"; break; }
        if (attempt > 0) await new Promise((r) => setTimeout(r, 900 * attempt));
        let res;
        try {
            res = await fetch("https://text.pollinations.ai/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: body,
                signal: aiSignal(left())
            });
        } catch (e) { lastStatus = "no connection"; continue; }   // network error / time limit: retry, then give up
        if (res.ok) return cleanAIText(await res.text());
        lastStatus = res.status;
        if (res.status !== 429 && res.status < 500) break;   // non-retryable
    }
    throw new Error("every AI service is busy right now (" + lastStatus + "). Please wait a moment and try again — the daily free limit may have been reached. You can also add your own key in Ask AI → settings.");
}

// Pulls out ONLY the step lines (drops any heading/title/intro), stripping the
// numbering so it can be re-rendered as a clean numbered list.
function procExtractSteps(text) {
    const lines = String(text).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

    // Prefer a clean numbered list: if the reply has numbered lines, use ONLY
    // those (this drops any reasoning / intro prose that isn't a step).
    const numbered = [];
    lines.forEach((l) => {
        const m = l.match(/^\d+[.)]\s*(.+)$/);
        if (m) numbered.push(m[1].trim());
    });
    if (numbered.length >= 2) return numbered;

    // Markdown table (| Step | What to do | Why |) - take the useful cells.
    const tableRows = lines.filter((l) => l.charAt(0) === "|" &&
        (l.match(/\|/g) || []).length >= 2 && !/^\|[\s:|\-]+\|?$/.test(l));
    if (tableRows.length >= 2) {
        let rows = tableRows.map((r) => r.split("|").map((c) => c.trim()).filter((c) => c.length))
            .filter((c) => c.length);
        if (rows.length && /\b(step|action|procedure|what to do|description)\b/i.test(rows[0].join(" "))) {
            rows = rows.slice(1);   // drop the header row
        }
        const out = rows.map((cells) => {
            const name = (cells[0] || "").replace(/^\d+[.)]\s*/, "").replace(/\*\*/g, "").trim();
            const action = (cells[1] || "").replace(/\*\*/g, "").trim();
            return action ? (name ? name + " - " + action : action) : name;
        }).filter(Boolean);
        if (out.length >= 2) return out;
    }

    // Fallback: bullets or plain lines (skip obvious heading lines).
    const steps = [];
    lines.forEach((l) => {
        if (/^(test\s+)?procedure\s*:?\s*$/i.test(l) || /^steps?\s*:?\s*$/i.test(l)) return;
        const m = l.match(/^[-*•]\s*(.+)$/);
        steps.push((m ? m[1] : l).trim());
    });
    return steps;
}

// Builds a pure numbered-steps list (no heading) with the report's styling.
function procStepsHtml(text) {
    const esc = (s) => String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    const steps = procExtractSteps(text);
    if (!steps.length) return "";
    return '<ol class="procedure-steps">' + steps.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>";
}

// Minimal markdown -> HTML for procedures (bold, numbered / bullet lists).
function procMdToHtml(raw) {
    let text = String(raw).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    const lines = text.split(/\r?\n/);
    let html = "", list = null;
    const close = () => { if (list) { html += "</" + list + ">"; list = null; } };
    lines.forEach((ln) => {
        const t = ln.trim();
        if (!t) { close(); return; }
        let m;
        // "## Heading" - without this a markdown heading fell through to the plain
        // <div> branch and showed its literal "##" characters to the user.
        if ((m = t.match(/^(#{1,6})\s+(.*?)\s*#*$/))) {
            close();
            html += "<h" + (m[1].length <= 2 ? 3 : 4) + ">" + m[2] + "</h" + (m[1].length <= 2 ? 3 : 4) + ">";
        }
        else if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += "<li>" + m[2] + "</li>"; }
        else if ((m = t.match(/^[-*•]\s+(.*)$/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += "<li>" + m[1] + "</li>"; }
        else { close(); html += "<div>" + t + "</div>"; }
    });
    close();
    return html;
}

(function () {

    const fetchBtn = document.getElementById("tcFetch");
    if (!fetchBtn) return;

    const testIn = document.getElementById("tcTest");
    const prodIn = document.getElementById("tcProduct");
    const listBtn = document.getElementById("tcList");
    const imgBtn = document.getElementById("tcImgBtn");
    const imgFile = document.getElementById("tcImgFile");
    const caseListEl = document.getElementById("tcCaseList");
    const tcAllBtn = document.getElementById("tcAllBtn");
    const tcAllRow = document.getElementById("tcAllRow");
    const tcAllEl = document.getElementById("tcAll");
    const refreshBtn = document.getElementById("tcRefresh");
    const downloadBtn = document.getElementById("tcDownload");
    const syncChk = document.getElementById("tcSync");
    const wrap = document.getElementById("tcResultWrap");
    const procEl = document.getElementById("tcProcedure");
    const stdEl = document.getElementById("tcStandard");
    const titleEl = document.getElementById("tcTitle");
    const status = document.getElementById("tcStatus");

    function setStatus(msg, kind) {
        status.textContent = msg || "";
        status.className = "cases-status" + (kind ? " " + kind : "");
    }

    // Show a spinner inside a button while it works, then restore it.
    function setBtnLoading(btn, on, text) {
        if (!btn) return;
        if (on) {
            if (!btn.dataset.orig) btn.dataset.orig = btn.innerHTML;
            btn.disabled = true;
            btn.classList.add("is-loading");
            btn.innerHTML = '<span class="btn-spin"></span> ' + (text || "Loading…");
        } else {
            btn.disabled = false;
            btn.classList.remove("is-loading");
            if (btn.dataset.orig) { btn.innerHTML = btn.dataset.orig; delete btn.dataset.orig; }
        }
    }

    // A big spinner panel in the results area while procedures load.
    function showLoadingPanel(text) {
        if (!tcAllEl) return;
        tcAllEl.innerHTML = '<div class="cases-loading"><span class="spin"></span>' +
            '<span>' + (text || "Loading…") + '</span></div>';
        tcAllEl.hidden = false;
    }

    function currentCases() {
        return Array.prototype.map.call(caseListEl.querySelectorAll(".tc-case"), (b) => b.textContent);
    }

    function save() {
        try {
            localStorage.setItem("tcState", JSON.stringify({
                test: testIn.value, product: prodIn.value,
                procedure: procEl.innerHTML, standard: stdEl.textContent,
                sync: syncChk.checked, shown: !wrap.hidden,
                cases: currentCases()
            }));
        } catch (e) { /* ignore */ }
    }

    function restore() {
        let s; try { s = JSON.parse(localStorage.getItem("tcState") || "null"); } catch (e) { s = null; }
        if (!s) return;
        testIn.value = s.test || ""; prodIn.value = s.product || "";
        procEl.innerHTML = s.procedure || ""; stdEl.textContent = s.standard || "—";
        syncChk.checked = !!s.sync;
        if (s.cases && s.cases.length) renderCases(s.cases);
        if (s.shown && (s.procedure || "").trim()) {
            wrap.hidden = false;
            titleEl.textContent = "Standard procedure — " + (s.test || "");
        }
    }

    // ---- list test cases for a product ----
    function parseTestCases(text) {
        const seen = new Set();
        return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
            // Headings ("Electrical Tests:", "## Mechanical", "**Environmental**")
            // and chatter ("Here are the test cases") are not test names.
            if (/^#+\s/.test(l) || /:\s*\**$/.test(l)) return "";
            if (/^(here|below|the following|these|note|sure|certainly)\b/i.test(l)) return "";
            const boldOnly = /^\**\s*\*\*[^*]+\*\*\s*$/.test(l) && !/test|check|inspection|verification|measurement|analysis/i.test(l);
            if (boldOnly) return "";
            l = l.replace(/\*\*|__|`/g, "");
            l = l.replace(/^\s*(?:[-*•]\s*)?\d+[.)]\s*/, "").replace(/^[-*•]\s*/, "");
            // Drop a trailing "- description", but NOT a hyphen inside the name:
            // "Charge - Discharge Cycle Life Test" used to be cut to "Charge".
            // A description starts with a lower-case word and is not itself a test.
            l = l.replace(/\s[-–:]\s+([a-z].*)$/, (m, rest) =>
                /\b(test|check|inspection|verification|measurement|analysis)\b/i.test(rest) ? m : "").trim();
            return l.replace(/[.;:]+$/, "").trim();
        }).filter((l) => {
            // 80, not 60: real names such as "Electromagnetic Compatibility (EMC)
            // Radiated Emissions Test (CISPR 25)" were being dropped.
            if (!l || l.length > 80 || !/[a-z]/i.test(l)) return false;
            // Near-duplicates: "Vibration Test" / "vibration test." / "Vibration tests"
            const k = l.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\btests?\b|\btesting\b/g, "").trim();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        }).slice(0, 70);
    }

    function renderCases(cases) {
        // Chips are stored (so the procedure panel can read them) but kept hidden -
        // we show the procedures alone, not the clickable test-case list.
        caseListEl.innerHTML = "";
        if (tcAllRow) tcAllRow.hidden = true;
        if (!cases || !cases.length) { caseListEl.hidden = true; return; }
        cases.forEach((name) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "tc-case";
            b.textContent = name;
            caseListEl.appendChild(b);
        });
        caseListEl.hidden = true;
        // The full table (every test with its standard, procedure and acceptance
        // criteria) is drawn straight away, so there is no separate "Show ALL"
        // step any more - a second button under the list made it look like the
        // procedures had to be fetched separately.
        if (tcAllRow) tcAllRow.hidden = true;
        // The "nothing here yet" note belongs only to an empty page.
        const empty = document.getElementById("tcEmpty");
        if (empty) empty.hidden = true;
    }

    // ---- product-type detection ----
    function isMotorProduct(product) {
        const s = String(product || "");
        // A "motor controller" / "motor driver" / "motor drive" is POWER ELECTRONICS,
        // not a motor. Matching on the word "motor" alone gave it the full motor set -
        // winding resistance, back-EMF, locked-rotor and cogging torque on a box with
        // no windings or rotor at all.
        if (/controller|inverter|converter|\bdriver\b|drive\s*(unit|electronics)|\bvfd\b|variable\s*frequency|\becu\b|\bvcu\b|\bmcu\b|\bbms\b|charger|\bobc\b|\bpdu\b/i.test(s)) return false;
        // A motor's cable, harness, connector or mount is not the motor.
        if (/\bcables?\b|\bwires?\b|wiring|harness|connector|\bmount(ing)?\b|bracket|\bcover\b|housing|casting|\bshafts?\b|\bcore\b|lamination|end\s*cap|\bmagnets?\b|\bbrush(es)?\b|\bbearing/i.test(s)) return false;
        // Not the bare word "gear": a gearbox on its own is a mechanical part and got
        // winding-resistance / back-EMF / magnetic-flux tests (a geared motor still
        // says "motor").
        // "stator" / "rotor" alone is a PART (a brake disc rotor, a stator stack) - it
        // has no windings to test and cannot rotate; only a whole machine does.
        return /motor|\bbldc\b|\bpmsm\b|actuator|\bpumps?\b|\bfans?\b|hub\s*motor|traction\s*(motor|machine)|\bgenerator\b|\balternator\b/i.test(s);
    }
    // A real battery / cell / pack - the only product type that gets cell-level tests.
    function isBatteryProduct(product) {
        // A load cell (force sensor), solar / fuel cell or cell phone is not a battery
        // cell - the word "cell" gave a load cell nail-penetration and crush tests.
        const p = String(product || "");
        if (/load\s*cells?|solar\s*cells?|photo[\s-]?voltaic|fuel\s*cells?|cell\s*phone/i.test(p) && !/batter/i.test(p)) return false;
        // A charger, enclosure, holder, cable or swapping station FOR a battery is
        // not a battery: "Battery Charger" was given nail penetration and crush.
        if (/charger|charging|enclosure|holder|\bbox\b|\bcase\b|\btray\b|\bcables?\b|\bwires?\b|harness|connector|terminal|swap|station|tester|bracket|\bcover\b|clamp|\bmount/i.test(p)) return false;
        // "pack" and "module" ON THEIR OWN are NOT batteries. They used to be in
        // this list, so a Camera Module, a Body Control Module, a Sensor Module
        // or a Tool Kit Pack was handed the whole cell-destruction set - nail
        // penetration, crush, forced discharge - with real GB 38031 / IEC 62133
        // step text. A battery module or pack still matches on its own wording
        // ("battery", "cell", "Li-ion", "48V 30Ah", "13S4P", "kWh"...).
        return /batter|\bcells?\b|\bbms\b|lithium|li[\s-]?ion|li[\s-]?po|lifepo|\bnmc\b|\bncm\b|\blfp\b|\blto\b|\bnca\b|\blco\b|sodium[\s-]?ion|\bna[\s-]?ion\b|energy\s*storage|\bess\b|accumulator|super[\s-]?cap|ultra[\s-]?cap|supercapacitor|ultracapacitor|\bpouch\b|prismatic|cylindrical\s*cell|\d+\s*s\s*\d+\s*p\b|\d+s\d+p\b|\d+\s*(kwh|wh|ah|mah)\b|\bsoc\b|\bsoh\b/i.test(String(product || ""));
    }
    // Power electronics: charger, controller, converter, inverter, DC-DC, power supply, etc.
    function isPowerProduct(product) {
        return /charger|charging\s*(station|point|pile|unit)|\bevse\b|wall\s*box|wallbox|controller|inverter|converter|dc[\s-]?dc|\bobc\b|on[\s-]?board\s*charg|\bvcu\b|\bmcu\b|\becu\b|\bpdu\b|power\s*supply|\bsmps\b|rectifier|\bpcu\b|drive\s*(unit|electronics)|power\s*electronic|\bvfd\b|variable\s*frequency\s*drive|motor\s*drive/i.test(String(product || ""));
    }
    // Electrical connector / wiring harness / relay / fuse / terminal.
    function isConnectorProduct(product) {
        const s = String(product || "");
        // A socket-head SCREW or a socket spanner is hardware, not a connector.
        if (/\bscrews?\b|\bbolts?\b|\bnuts?\b|spanner|wrench|\bkey\b|\bbit\b/i.test(s)) return false;
        // Electrical cables / charge ports / sockets are connector-family parts - but
        // not a brake / throttle / clutch (Bowden) cable, or a cable gland / tie / clamp.
        if (/(?<!(brake|throttle|clutch|choke|speedo(meter)?|accelerator|seat|lock)\s)\bcables?\b(?!\s*(gland|tie|clamp|entry|lug|bushing|joint|conduit|grommet))/i.test(s) ||
            /charging\s*(port|inlet|socket|gun)|\bsocket\b|type[\s-]*2\b|\binlet\b/i.test(s)) return true;
        return /connector|\bharness\b|wir(e|ing)\s*harness|cable\s*assembly|\brelay\b|\bfuse\b|fuse\s*(box|holder)|terminal\s*(block|lug)|ring\s*terminal|\blugs?\b|\bbusbar\b|bus\s*bar|\bsplice\b|receptacle|\bheader\b|contact\s*pin|\bcrimp|\bpin\s*header|wire\s*connector/i.test(String(product || ""));
    }
    // Handlebar controls / switchgear: horn, indicator, headlamp, beam, pass,
    // hazard, mode, kill switches - a combination switch assembly, not an ECU.
    function isSwitchProduct(product) {
        const s = String(product || "");
        // A switch-mode power supply or a network switch is not a mechanical switch.
        if (/switch(ed|ing)?[\s-]*mode|\bsmps\b|(network|ethernet|poe|lan)\s*switch|switching\s*(power|regulator)/i.test(s)) return false;
        // Any other switch - brake lever / stop-lamp / side-stand / micro / limit switch.
        // ("Brake Lever Switch" fell through to the generic environmental list.)
        if (/\bswitch(es)?\b/i.test(s)) return true;
        if (/horn\s*button|(push|press|start|kill)\s*button/i.test(s)) return true;
        return /handle\s*bar|handlebar|switch\s*gear|switchgear|combination\s*switch|control\s*switch(es)?|handle\s*switch|switch\s*(assembly|console|cube|pod|box|panel|cluster)|\brhs\s*switch|\blhs\s*switch|horn\s*switch|indicator\s*switch|headlamp\s*switch|head\s*lamp\s*switch|beam\s*switch|dimmer\s*switch|pass\s*switch|kill\s*switch|hazard\s*switch|toggle\s*switch|rocker\s*switch|push\s*button\s*switch|handlebar\s*control|handle\s*bar\s*control|left\s*(hand|switch)\s*(cube|assembly|control)|right\s*(hand|switch)\s*(cube|assembly|control)/i.test(String(product || ""));
    }
    // Installation material (adhesive / tape / sheet / film / foam / gasket / sealant...).
    function isMaterialProduct(product) {
        // A brake pad / key pad is a part; a stator lamination or steel sheet is metal.
        const ms = String(product || "");
        // A metal PART is not a material - but an aluminium foil TAPE still is.
        if (/brake|key\s*pad|touch\s*pad|foot\s*pad|stator|rotor|lamination\s*(stack|core)|\bsteel\b|alumin|copper|\bmetal\b/i.test(ms) &&
            !/tape|adhesive|\bfilm\b|\bfoil\b|laminate\s*sheet|sticker|\blabel\b/i.test(ms)) return false;
        return /glue|adhesive|adhesion|\bpeel\b|\btape\b|\bsheet\b|\bfilm\b|foam|gasket|sealant|epoxy|\bresin\b|coating|laminat|\blabel\b|sticker|bonding|silicone|potting|encapsul|\bfoil\b|membrane|liner|\bpad\b|mylar|kapton|acrylic\s*(tape|adhesive)|double[\s-]?sided|pressure[\s-]?sensitive|\bpsa\b|\bvhb\b|insulation\s*(tape|sheet|paper)|thermal\s*(interface|paste|grease|compound|gap\s*filler|gel)|\btim\b|thermal\s*management\s*material/i.test(String(product || ""));
    }
    // Electrical-safety PPE: insulating gloves / mats / blankets / sleeves / boots.
    function isPPEProduct(product) {
        return /\bglove|gauntlet|\bppe\b|insulating\s*(glove|mat|blanket|sleeve|boot)|dielectric\s*(glove|mat|boot|blanket|sleeve)|arc[\s-]?flash\s*(glove|suit|hood|wear)|safety\s*(glove|mat)|protective\s*(glove|wear)|rubber\s*glove/i.test(String(product || ""));
    }
    // Eye protection PPE: safety goggles / spectacles / face shield / visor (EN 166).
    function isEyewearProduct(product) {
        return /goggle|safety\s*(glasses|spectacle|eyewear)|spectacle|eye\s*(protection|wear|shield)|eyewear|face\s*shield|\bvisor\b|welding\s*(helmet|shield|mask)|protective\s*eyewear/i.test(String(product || ""));
    }
    // Mechanical fastener / hardware: washer / bolt / nut / screw / rivet / pin.
    function isFastenerProduct(product) {
        // Tools and gauges, not fasteners (a micrometer SCREW gauge is an instrument).
        if (/screw\s*jack|\bjack\b|driver|gun|machine|micrometer|caliper|\bgauge\b|\bmeter\b|tester|wrench|spanner/i.test(String(product || ""))) return false;
        return/washer|\bbolts?\b|\bnuts?\b|\bscrews?\b|\brivets?\b|fastener|\bstud\b|circlip|retaining\s*ring|threaded\s*rod|hex\s*(bolt|nut|head)|spring\s*washer|lock\s*washer|\bhardware\b|\banchor\b|\bshim\b|\bspacer\b|\bkeyway\b|\bkey\b\s*(steel|stock)/i.test(String(product || ""));
    }
    // Electrical / electronic / environmental-electrical tests that don't apply to a fastener.
    function isFastenerDrop(name) {
        // (not "Vibration Loosening (Junker)" - that IS a fastener test)
        return /ip\s*rating|ingress|\bip[x0-9]|vibration(?!\s*loosening)|mechanical\s*shock|thermal\s*shock|temperature\s*cycl|humidity|\bemc\b|\bemi\b|emission|immunit|susceptib|electromagnet|\bsurge\b|insulation\s*resistance|dielectric\s*strength|hi[\s-]?pot|ground\s*continu|earth\s*continu|over[\s-]?voltage|reverse\s*polarit|load\s*dump|jump\s*start|winding|\bmotor\b|\bbms\b|\bpack\b|\bcell\b|leakage\s*current|performance\s*curve|efficien|\bcan\b/i.test(String(name || ""));
    }
    // Passive cable-sealing fitting: cable gland / conduit / grommet / cable clamp.
    function isFittingProduct(product) {
        return /cable\s*gland|\bglands?\b|conduit|grommet|cable\s*(entry|clamp|tie|lug|bushing|joint)|strain\s*relief|cord\s*grip|\bbushing\b|\bferrule\b|sealing\s*(nut|ring|fitting)|entry\s*(fitting|seal)/i.test(String(product || ""));
    }
    // Motor / battery / automotive electrical tests that don't apply to a passive fitting.
    function isFittingDrop(name) {
        return /winding|\bmotor\b|\bpack\b|\bcell\b|dielectric\s*strength|hi[\s-]?pot|insulation\s*resistance|\bemc\b|\bemi\b|emission|immunit|susceptib|electromagnet|\bsurge\b|reverse\s*polarit|load\s*dump|jump\s*start|automotive|iso\s*16750|iso\s*7637|cispr|performance\s*curve|efficien|no[\s-]?load|\bbms\b|contactor|estimat|firmware|leakage\s*current|over[\s-]?voltage/i.test(String(name || ""));
    }
    // Hand-held test & measurement instrument (clamp meter, multimeter, tester...).
    function isInstrumentProduct(product) {
        return /clamp\s*meter|multi\s*meter|multimeter|\bmeter\b|\btester\b|oscilloscope|\bdso\b|\bmso\b|\bdmm\b|megohm|megger|insulation\s*tester|earth\s*tester|measuring\s*gauge|dial\s*gauge|\bprobe\b|data\s*logger|thermometer|ammeter|voltmeter|ohmmeter|\blcr\b|lux\s*meter|sound\s*level\s*meter|tachometer|vernier\s*caliper|caliper\s*gauge|micrometer|measuring\s*instrument|test\s*instrument|analyser|analyzer|calibrator/i.test(String(product || ""));
    }
    // Vehicle/battery/automotive-specific tests that do NOT apply to a measuring instrument.
    function isVehicleTest(name) {
        return isBatteryTest(name) ||
            /winding|\bmotor\b|torque|pull[\s-]?out|\bgear\b|backlash|reverse\s*polarit|load\s*dump|jump\s*start|\bcrank\b|\bsurge\b|ground\s*continu|earth\s*continu|dielectric\s*strength|hi[\s-]?pot|salt\s*spray|automotive|iso\s*16750|iso\s*7637|cispr|no[\s-]?load\s*current|performance\s*curve/i.test(String(name || ""));
    }
    // A device/electrical/mechanical-device test that does NOT apply to a material.
    function isDeviceTest(name) {
        return /ip\s*rating|ingress|\bip[x0-9]/i.test(String(name || "")) ||
            /vibration|mechanical\s*shock|drop\s*test|\bemc\b|\bemi\b|emission|immunit|electromagnet|esd\b|insulation\s*resistance|ground\s*continu|earth\s*continu|\bsurge\b|over[\s-]?voltage|reverse\s*polarit|load\s*dump|jump\s*start|crank|transient|overcharg|discharg|short[\s-]?circuit|\bmotor\b|torque|efficien|no[\s-]?load|winding|\bbearing\b|magnetic|thermal\s*overload|overload|overcurrent|dielectric\s*strength|hi[\s-]?pot|performance\s*curve|inrush|power\s*factor|\bcan\b|\bbms\b|contactor|balanc|estimat|firmware|display|touch|indicator|telltale|gear|backlash/i.test(String(name || ""));
    }
    // A battery CELL-level test - must NOT appear in a motor, charger or controller report.
    function isBatteryTest(name) {
        // "Battery life" / "low battery" on an instrument is about how long it
        // runs on its own battery - not a cell-destruction test. Treating it as
        // one deleted a curated instrument test from the instrument's own list
        // (a clamp meter lost its Battery Life / Low-Battery Test).
        if (/batter(y|ies)?\s*(life|back[\s-]?up|indicator|level|status|warning)|low[\s-]*batter/i.test(String(name || ""))) return false;
        return /over[\s-]*charg|over[\s-]*dis[\s-]*charg|deep\s*discharg|forced\s*discharg|cell\s*short|cycle\s*life|charge\s*.?\s*discharge\s*cycle|thermal\s*runaway|thermal\s*propagat|nail\s*penetrat|\bcrush\b|altitude|calendar\s*ag|state\s*of\s*(charge|health)|\bcell\b|\bbatter|energy\s*density|specific\s*energy|capacity\s*(reten|fade)|internal\s*resistance|dcir|\beis\b|impedance\s*spectro|high[\s-]*rate\s*discharg|rapid\s*discharg/i.test(String(name || ""));
    }
    // A fuse / relay BOX, holder or socket is a connector part, not the device itself.
    const FUSE_RELAY_BOX = /(fuse|relay)\s*(and|&|\/)?\s*(fuse|relay)?\s*(box|holder|block|panel|carrier|socket|base)/i;
    // Relay / contactor: a coil-operated switching device - not a plug-in connector.
    function isRelayProduct(product) {
        const s = String(product || "");
        return !FUSE_RELAY_BOX.test(s) && /\brelays?\b|contactor|solenoid\s*switch|starter\s*solenoid/i.test(s);
    }
    // A fuse itself (blade / cartridge / EV high-voltage fuse / fusible link).
    function isFuseProduct(product) {
        const s = String(product || "");
        return !FUSE_RELAY_BOX.test(s) && /\bfuses?\b|fusible\s*link/i.test(s);
    }
    function isBusbarProduct(product) {
        return /bus[\s-]*bars?\b/i.test(String(product || ""));
    }
    // A multi-control switch ASSEMBLY (handlebar switchgear), as opposed to one switch.
    function isSwitchAssembly(product) {
        return /handle\s*bar|handlebar|switch\s*gear|switchgear|combination|switches\b|(switch|control)\s*(assembly|console|cube|pod|box|panel|cluster|module)|\b(rhs|lhs)\b|(left|right)\s*(hand|switch)/i.test(String(product || ""));
    }
    // A bare battery cell - not a module, pack or BMS.
    function isBareCell(product) {
        const s = String(product || "");
        return isBatteryProduct(s) && /\bcells?\b/i.test(s) &&
            !/pack|module|\bbms\b|battery\s*management|system|\bess\b|holder|balanc|monitor/i.test(s);
    }
    // Protective headgear. Checked before the mechanical-part rule so a helmet
    // gets its OWN tests (impact absorption, retention system, shell
    // penetration) instead of the shared environmental set - it used to be
    // offered salt-spray and IP-rating tests and nothing that protects a head.
    function isHelmetProduct(product) {
        const s = String(product || "");
        // A welding / industrial helmet or hard hat is not a riding helmet (IS 4151).
        // Helmet ACCESSORIES (visor, strap, liner, bracket) are not the helmet.
        if (/visor|face\s*shield|strap|liner|padding|bracket|mount|camera|intercom|bluetooth/i.test(s)) return false;
        return /\bhelmets?\b|head\s*(gear|protection)|crash\s*helmet/i.test(s) &&
            !/welding|industrial|construction|hard\s*hat|mining|\bsafety\s*helmet/i.test(s);
    }
    // A road tyre / tube. Same reason: it had no tyre test of its own.
    function isTyreProduct(product) {
        const s = String(product || "");
        return /\btyres?\b|\btires?\b|\btubes?\b.*\b(tyre|tire)\b|pneumatic\s*tyre/i.test(s) &&
            !/pressure\s*sensor|pressure\s*monitor|\btpms\b|valve|changer|inflator|lever|gauge/i.test(s);
    }
    // A lamp / lighting device (head, tail, indicator, DRL). NOT a lamp SWITCH -
    // that is switchgear and is matched before this.
    function isLampProduct(product) {
        const s = String(product || "");
        // A lamp's wiring, connector or holder is tested as wiring, not photometrically.
        if (/\bswitch|relay\b|\bfuse\b|socket|holder|wiring|harness|connector|\bwires?\b|\bcables?\b|bracket|\bmount(ing)?\b|\bcover\b|housing/i.test(s)) return false;
        return /head\s*lamp|headlamp|headlight|head\s*light|tail\s*(lamp|light)|stop\s*lamp|brake\s*light|indicator\s*(lamp|light)|turn\s*signal|blinker|\bdrl\b|daytime\s*running|fog\s*lamp|number\s*plate\s*lamp|licence\s*plate\s*lamp|position\s*lamp|strip\s*light|light\s*bar|work\s*light|flood\s*light|\blamp\b|\bheadlamps?\b/i.test(s);
    }
    // An audible warning device.
    function isHornProduct(product) {
        const s = String(product || "");
        if (/\bswitch|relay\b|\bfuse\b|wiring|harness|connector|bracket|\bwires?\b|\bcables?\b|button/i.test(s)) return false;
        return /\bhorns?\b|buzzer|audible\s*warning|siren/i.test(s);
    }
    // A purely mechanical part: no electrical test applies to it.
    function isMechanicalPart(product) {
        const s = String(product || "");
        if (/electr|insulat|lamp|light|\bled\b|horn|sensor|switch|motor|wir(e|ing)|(?<!(brake|throttle|clutch|choke|seat|lock)\s)cable|harness|heat(er|ed)|\busb\b|camera|speaker|display|charg|batter|\bcells?\b|controller|\becu\b|\bvcu\b|actuator|solenoid|\bpower\b|signal|indicator|relay|fuse|connector|\babs\s*(module|unit|sensor|system|pump|ecu|control)\b|pump|\bfan\b/i.test(s)) return false;
        return /gear|transmission|helmet|\btyres?\b|\btires?\b|\bseats?\b|mirror|\bframe\b|chassis|\bwheels?\b|\brims?\b|fender|mud\s*guard|bracket|foot\s*rest|grab\s*rail|carrier|brake\s*(pad|disc|shoe|drum|caliper|lever|assembly|rotor)|disc\s*brake|drum\s*brake|radiator|heat\s*sink|cooling\s*fin|suspension|shock\s*absorber|\bfork\b|swing\s*arm|sprocket|\bchain\b|\bbelt\b|pulley|\baxle\b|\bshaft\b|bearing|body\s*panel|side\s*panel|floor\s*board|\bstand\b|leg\s*guard|number\s*plate|\bspring\b|\bhinge\b|\blatch\b|spanner|wrench|plier|hammer|casting|forging|brake\s*(fluid|hose|cable|master|cylinder)|master\s*cylinder|\bhoses?\b|brake\s*fluid|(throttle|clutch|choke)\s*cable|inner\s*tube|\bvalves?\b|safety\s*(shoe|boot)s?|\bshoes?\b|hard\s*hat|screwdriver|screw\s*jack/i.test(s);
    }
    // An electrical / electronic / vehicle-supply test (dropped for mechanical parts).
    function isElectricalTest(name) {
        return /insulation\s*resist|dielectric\s*strength|hi[\s-]?pot|\bemc\b|\bemi\b|emission|immunit|susceptib|electromagnet|\besd\b|electrostatic|\bsurge\b|ground\s*continu|earth\s*continu|over[\s-]?voltage|reverse\s*polarit|load\s*dump|jump\s*start|\bcrank|ac\s*ripple|superimposed|iso\s*7637|iso\s*11452|cispr|leakage\s*current|\bcan\b|quiescent|wake[\s-]?up|firmware|winding|back[\s-]?emf|\bmotor\b|no[\s-]?load\s*current|inrush|power\s*factor|\bbms\b/i.test(String(name || ""));
    }

    // ---- built-in master list of standard EV test cases (each maps to a real procedure) ----
    function curatedTests(product, wantSplit) {
        // Relays / contactors, fuses and busbars switch, protect or carry current -
        // they are not plug-in connectors, so no mating-force, crimp pull-out or
        // mating-cycle tests. Checked before the switch and connector sets, which
        // would otherwise catch them by name.
        if (isRelayProduct(product)) {
            const contactor = /contactor/i.test(String(product || ""));
            return [
                "Coil Pick-up / Drop-out Voltage Test",
                "Contact Voltage Drop / Resistance Test",
                "Contact Bounce / Response Time Test",
                "Temperature Rise at Rated Current Test",
                "Making / Breaking Capacity Test"
            ].concat(contactor ? ["Short-Time Withstand Current Test"] : []).concat([
                "Electrical Endurance (Operating Life) Test",
                "Insulation Resistance Test",
                "Dielectric Strength (Hi-Pot) Test",
                "Vibration Test",
                "Mechanical Shock Test",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "Salt Spray Corrosion Test"
            ]);
        }
        if (isFuseProduct(product)) {
            return [
                "Fuse Time-Current Characteristic Test",
                "Breaking Capacity Test",
                "Fuse Voltage Drop / Cold Resistance Test",
                "Temperature Rise at Rated Current Test",
                "Vibration Test",
                "Mechanical Shock Test",
                "Thermal Shock Test",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "Salt Spray Corrosion Test"
            ];
        }
        if (isBusbarProduct(product)) {
            return [
                "Busbar Joint Resistance Test",
                "Temperature Rise at Rated Current Test",
                "Short-Time Withstand Current Test",
                "Insulation Resistance Test",
                "Dielectric Strength (Hi-Pot) Test",
                "Vibration Test",
                "Mechanical Shock Test",
                "Thermal Shock Test",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "Salt Spray Corrosion Test"
            ];
        }
        // A single switch (brake lever, stop-lamp, side-stand, micro switch) is a
        // passive ON/OFF device: no multi-control function checks or supply-line
        // transient tests - those belong to the handlebar switchgear below.
        if (isSwitchProduct(product) && !isSwitchAssembly(product)) {
            return [
                "Switch ON/OFF Operation Test",
                "Switch Contact Resistance Test",
                "Electrical Continuity Test",
                "Operating / Actuation Force Test",
                "Switch Operating Endurance Test",
                "Contact Bounce / Response Time Test",
                "Temperature Rise at Rated Current Test",
                "Insulation Resistance Test",
                "Dielectric Strength (Hi-Pot) Test",
                "IP Rating (Ingress Protection) Test",
                "Vibration Test",
                "Mechanical Shock Test",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "Salt Spray Corrosion Test"
            ];
        }
        // Handlebar controls / switchgear: the switch FUNCTIONS come first, then
        // the electrical, endurance, environmental and automotive supply tests.
        if (isSwitchProduct(product)) {
            return [
                "Switch Function / Operation Test",
                "Individual Control Function Verification",
                "Switch Contact Resistance Test",
                "Electrical Continuity Test",
                "Operating / Actuation Force Test",
                "Switch Operating Endurance Test",
                "Contact Bounce / Response Time Test",
                "Current-Carrying Capacity / Temperature Rise Test",
                "Insulation Resistance Test",
                "Dielectric Strength (Hi-Pot) Test",
                "IP Rating (Ingress Protection) Test",
                "Vibration Test",
                "Mechanical Shock Test",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "Salt Spray Corrosion Test",
                "UV / Weathering Resistance Test",
                "Reverse Polarity Protection Test",
                "Load Dump Test",
                "ISO 7637-2 Transient Immunity Test"
            ];
        }
        // A helmet is judged on whether it protects a head - not on salt spray
        // and IP rating, which is all it used to be offered.
        if (isHelmetProduct(product)) {
            return [
                "Impact Absorption Test",
                "Shell Penetration (Striker) Test",
                "Retention System Strength Test",
                "Chin Strap Slippage / Elongation Test",
                "Roll-Off (Dynamic Stability) Test",
                "Shell Rigidity (Lateral Deformation) Test",
                "Field of Vision (Helmet) Test",
                "Visor Optical & Light Transmission Test",
                "Flammability Test (UL 94)",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "UV / Weathering Resistance Test"
            ];
        }
        if (isTyreProduct(product)) {
            return [
                "Tyre Dimensions & Section Width Test",
                "High-Speed Performance Test",
                "Tyre Load / Endurance Test",
                "Bead Unseating Resistance Test",
                "Tyre Strength (Plunger Energy) Test",
                "Rolling Resistance Test",
                "Tread Wear Indicator & Marking Inspection",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "UV / Weathering Resistance Test"
            ];
        }
        // A lamp is judged photometrically first: how much light goes where, in
        // what colour, and whether it survives its own heat.
        if (isLampProduct(product)) {
            // Only a headlamp (or fog lamp) has a passing-beam cut-off line to aim.
            const beam = /head\s*(lamp|light)|headlamp|headlight|fog\s*(lamp|light)|low\s*beam|high\s*beam|passing\s*beam/i.test(String(product || ""));
            return [
                "Photometric Beam Pattern Test",
                "Luminous Intensity Test"
            ].concat(beam ? ["Cut-Off Line & Aiming Test"] : []).concat([
                "Colour Coordinates (Chromaticity) Test",
                "Thermal Endurance (Continuous Burning) Test",
                "Lamp Supply Voltage Range Test",
                "Over-Voltage Surge Test",
                "Reverse Polarity Protection Test",
                "IP Rating (Ingress Protection) Test",
                "Vibration Test",
                "Mechanical Shock Test",
                "Thermal Shock Test",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "Salt Spray Corrosion Test",
                "UV / Weathering Resistance Test",
                "EMC Emissions Test",
                "EMC Immunity / Susceptibility Test"
            ]);
        }
        // A horn is judged on how loud it is and at what pitch.
        if (isHornProduct(product)) {
            return [
                "Sound Pressure Level Test",
                "Sound Frequency Spectrum Test",
                "Horn Current Consumption Test",
                "Horn Operating Endurance Test",
                "Horn Supply Voltage Range Test",
                "Over-Voltage Surge Test",
                "Reverse Polarity Protection Test",
                "IP Rating (Ingress Protection) Test",
                "Vibration Test",
                "Mechanical Shock Test",
                "Thermal Shock Test",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "Salt Spray Corrosion Test",
                "EMC Emissions Test",
                "EMC Immunity / Susceptibility Test"
            ];
        }
        // Eye protection (safety goggles / spectacles / face shields): EN 166 / ANSI Z87.1.
        if (isEyewearProduct(product)) {
            return [
                "Optical Quality / Refractive Power Test",
                "Luminous Transmittance & UV Filter Test",
                "Low / Medium / High Energy Impact Test",
                "Increased Robustness Test",
                "Field of Vision Test",
                "Resistance to Surface Damage (Fine Particles) Test",
                "Resistance to Fogging (Anti-Fog) Test",
                "Chemical Splash / Liquid Droplet Test",
                "Resistance to Ignition Test",
                "Headband / Frame Strength Test"
            ];
        }
        // Electrical connectors / wiring harness / relays / fuses: IEC 60512 / EIA-364.
        if (isConnectorProduct(product)) {
            return [
                "Contact Resistance Test",
                "Mating / Unmating Force Test",
                "Crimp Pull-Out Test",
                "Current-Carrying Capacity / Temperature Rise Test",
                "Mating Cycle Durability Test",
                "Insulation Resistance Test",
                "Dielectric Strength (Hi-Pot) Test",
                "IP Rating (Ingress Protection) Test",
                "Vibration Test",
                "Mechanical Shock Test",
                "Thermal Shock Test",
                "Temperature Cycling Test",
                "Humidity Cycling Test",
                "Salt Spray Corrosion Test"
            ];
        }
        // Mechanical fasteners / hardware (washers / bolts / nuts): DIN / ISO 898 / IS 3063.
        if (isFastenerProduct(product)) {
            // The spring-load test (DIN 127 free height / flatten) is for spring and
            // lock washers only - not a bolt, nut, screw or rivet.
            const springy = /washer|spring|belleville|disc\s*spring|circlip|retaining\s*ring/i.test(String(product || ""));
            return [
                "Dimensional & Visual Inspection",
                "Hardness Test (Rockwell)"
            ].concat(springy ? ["Compression / Spring Load Test"] : []).concat([
                "Decarburization Test",
                "Coating / Plating Thickness Test",
                "Salt Spray Corrosion Test",
                "Hydrogen Embrittlement Test",
                "Vibration Loosening (Junker) Test",
                "Torque-Tension Test"
            ]);
        }
        // Cable glands / fittings / conduit (passive sealing fittings): IEC 62444.
        if (isFittingProduct(product)) {
            return [
                "IP Sealing / Ingress Protection Test",
                "Cable Retention / Pull-Out Test",
                "Assembly Torque Test",
                "Impact Resistance (IK) Test",
                "Temperature Cycling Test",
                "Damp Heat / Humidity Test",
                "Salt Spray Corrosion Test",
                "Earth Continuity Test",
                "Glow-Wire Flammability Test",
                "UV / Weathering Resistance Test",
                "Vibration Test"
            ];
        }
        // Measuring instruments (clamp meter / multimeter / oscilloscope / tester).
        // The list is tailored to the instrument TYPE (a scope has no clamp jaw, etc.);
        // all share the IEC 61010 safety and IEC 61326 EMC / environmental tests.
        if (isInstrumentProduct(product)) {
            const p = String(product || "").toLowerCase();
            const common = [
                "CAT Rating / Transient Overvoltage Test",
                "Voltage Withstand & Insulation Test (IEC 61010)",
                "EMC Test (IEC 61326)",
                "Battery Life / Low-Battery Test",
                "Drop Test",
                "Operating Temperature & Humidity Test",
                "IP Rating (Ingress Protection) Test"
            ];
            if (/oscilloscope|\bscope\b|\bdso\b|\bmso\b/.test(p)) {
                return [
                    "Vertical (Amplitude) Accuracy Test",
                    "DC Gain Accuracy Test",
                    "Timebase (Horizontal) Accuracy Test",
                    "Bandwidth (-3 dB) Test",
                    "Rise Time Test",
                    "Trigger Sensitivity & Jitter Test",
                    "Input Impedance & Capacitance Test",
                    "Sample Rate / Acquisition Test"
                ].concat(common);
            }
            // A MECHANICAL gauge (caliper, micrometer, dial gauge, tape) measures
            // size, not volts: the multimeter list did not belong to it.
            if (/caliper|micrometer|dial\s*gauge|vernier|height\s*gauge|bore\s*gauge|feeler|thread\s*gauge|tape\s*measure|\bruler\b|depth\s*gauge/.test(p)) {
                return [
                    "Measurement Accuracy Test",
                    "Repeatability Test",
                    "Dimensional & Visual Inspection",
                    "Drop Test",
                    "Operating Temperature & Humidity Test"
                ];
            }
            // An insulation / earth tester is judged on its own high-voltage ranges.
            if (/megger|megohm|insulation\s*(resistance\s*)?tester|earth\s*(resistance\s*)?tester|ground\s*tester|hi[\s-]?pot\s*tester|continuity\s*tester/.test(p)) {
                return [
                    "Insulation Resistance Test",
                    "Measurement Accuracy Test",
                    "Test Voltage Output Accuracy Test",
                    "Resistance Measurement Accuracy Test"
                ].concat(common);
            }
            // Single-quantity meters: only the accuracy of what they measure.
            if (/lux\s*meter|sound\s*level\s*meter|tachometer|thermometer|anemometer|hygrometer|data\s*logger|\bprobe\b|force\s*gauge|torque\s*(meter|wrench\s*tester)/.test(p)) {
                return ["Measurement Accuracy Test", "Repeatability Test"].concat(common);
            }
            if (/clamp\s*meter/.test(p)) {
                return [
                    "Current Measurement Accuracy Test",
                    "Voltage Measurement Accuracy Test",
                    "Resistance Measurement Accuracy Test",
                    "Clamp Jaw Position Sensitivity Test"
                ].concat(common);
            }
            // Generic DMM / multimeter / tester
            return [
                "Voltage Measurement Accuracy Test",
                "Current Measurement Accuracy Test",
                "Resistance Measurement Accuracy Test",
                "Continuity / Diode Measurement Accuracy Test"
            ].concat(common);
        }
        // Electrical-safety PPE (insulating gloves / mats / sleeves): dedicated set.
        if (isPPEProduct(product)) {
            return [
                "Dielectric Proof-Voltage Test (ASTM D120)",
                "AC/DC Leakage Current Test",
                "Cut Resistance Test (EN 388)",
                "Abrasion Resistance Test (EN 388)",
                "Tear Resistance Test (EN 388)",
                "Puncture Resistance Test (EN 388)",
                "Tensile Strength & Elongation Test",
                "Ozone Resistance Test (ASTM D1149)",
                "Arc-Flash Rating Test (ASTM F2675)",
                "Thickness Measurement",
                "Flammability Test (UL 94)"
            ];
        }
        // Installation materials (glue / tape / sheet / film / foam / gasket) get a
        // self-contained MATERIAL test set - not the electrical/mechanical device tests.
        if (isMaterialProduct(product)) {
            // Tack, unwind and peel tests only mean something for tapes, labels and
            // pressure-sensitive adhesives - not for a gasket, coating or potting.
            const tapeLike = /tape|label|sticker|double[\s-]?sided|pressure[\s-]?sensitive|\bpsa\b|\bvhb\b|\bfoil\b|\bfilm\b|mylar|kapton|thermal\s*pad/i.test(String(product || ""));
            const glueLike = tapeLike || /glue|adhesive|adhesion|bonding|epoxy|sealant|silicone/i.test(String(product || ""));
            const tapeOnly = /peel\s*adhesion|shear\s*adhesion|loop\s*tack|unwind|coat\s*weight/i;
            return [
                "Peel Adhesion Test",
                "Shear Adhesion / Holding Power Test",
                "Lap Shear Strength Test",
                "Loop Tack Test",
                "Unwind Force Test",
                "Tensile Strength & Elongation Test",
                "Thickness Measurement",
                "Coat Weight / Density Test",
                "Hardness (Shore) Test",
                "Dielectric Breakdown Voltage Test",
                "Volume / Surface Resistivity Test",
                "Heat Aging & Adhesion Retention Test",
                "Low-Temperature Flexibility Test",
                "Dimensional Stability / Shrinkage Test",
                "Water Absorption Test",
                "Chemical / Solvent Resistance Test",
                "UV / Weathering Resistance Test",
                "Temperature Cycling Test",
                "Humidity Resistance Test",
                "Salt Spray Corrosion Test",
                "Flammability Test (UL 94)"
            ].filter((n) => (tapeLike || !tapeOnly.test(n)) && (glueLike || !/lap\s*shear/i.test(n)));
        }
        const general = [
            "IP Rating (Ingress Protection) Test",
            "Vibration Test",
            "Mechanical Shock Test",
            "Thermal Shock Test",
            "Temperature Cycling Test",
            "Humidity Cycling Test",
            "Salt Spray Corrosion Test",
            "Insulation Resistance Test",
            "Dielectric Strength (Hi-Pot) Test",
            "EMC Emissions Test",
            "EMC Immunity / Susceptibility Test",
            "Over-Voltage Surge Test",
            "Ground Continuity Test"
        ];
        const motor = [
            "Motor Performance Curve Test",
            "Efficiency Test",
            "No-Load Current Test",
            "Load Current & Torque Test",
            "Locked-Rotor / Starting Torque Test",
            "Back-EMF / Voltage Constant Test",
            "Cogging Torque Measurement",
            "Winding Resistance Test",
            "Speed Regulation Test",
            "Direction of Rotation Test",
            "Overspeed Test",
            "Temperature Rise Test",
            "Thermal Overload Protection Test",
            "Overload / Overcurrent Test",
            "Acoustic Noise Test",
            "Magnetic Flux Measurement",
            "Bearing Performance Test",
            "Rotor Dynamic Balancing Test",
            "Endurance / Durability Test"
        ];
        const power = [
            "Input Voltage Range Verification",
            "Output Voltage Regulation Accuracy",
            "Power Conversion Efficiency Test",
            "Maximum Continuous Current Limit",
            "Fault Current Detection and Trip Test",
            "Short-Circuit Protection Response Test",
            "Over-Temperature Derating / Shutdown Test",
            "Inrush Current Measurement",
            "Power Factor & Harmonics Test",
            "Reverse Power Flow Protection Test",
            "Standby / No-Load Power Test",
            "Heat Dissipation under Full Load",
            "Maximum Operating Temperature Limit",
            "CAN Communication Test",
            "Diagnostic / Fault Handling Test"
        ];
        const battery = [
            "Overcharge Protection Test",
            "Over-discharge Protection Test",
            "External Short-Circuit Test",
            "Nail Penetration Test",
            "Crush Test",
            "Forced Discharge Test",
            "Thermal Runaway / Propagation Test",
            "Altitude Simulation Test",
            "Charge/Discharge Cycle Life Test",
            "Energy Density Measurement",
            "Capacity Retention Test",
            "Internal Resistance Test",
            "Impedance (EIS) Test",
            "High-Rate Discharge Test",
            "Accelerated Aging Test",
            "BMS Functional Safety Test",
            "IP67 / IP68 Immersion Test",
            "IPX7 Water Ingress Test"
        ];
        const gearbox = [
            "Gearbox Efficiency Test",
            "Gear Temperature Rise under Rated Torque",
            "Gear Torque Ripple Measurement",
            "Variable Frequency Drive Load Test",
            "Gear-Ratio Power Consumption Test",
            "Gear Backlash Measurement",
            "Bearing Performance Test"
        ];
        const electronics = [   // shared by BMS / VCU / controller / dashboard
            "CAN Communication Test",
            "Diagnostic / Fault Handling Test",
            "Sleep / Quiescent Current Test",
            "Wake-Up Time Test",
            "Firmware Functional Safety Test"
        ];
        const bms = [
            "Cell Voltage Measurement Accuracy",
            "Pack Current Measurement Accuracy",
            "Temperature Measurement Accuracy",
            "State-of-Charge Estimation Accuracy",
            "State-of-Health Estimation Accuracy",
            "Passive Cell Balancing Test",
            "Active Cell Balancing Test",
            "Over-Voltage Protection Test",
            "Under-Voltage Protection Test",
            "Over-Current Protection Test",
            "Over-Temperature Protection Test",
            "Under-Temperature Protection Test",
            "Short-Circuit Protection Response Test",
            "Contactor / Pre-Charge Control Test",
            "Insulation Monitoring (IMD) Test",
            "CAN Communication Test",
            "Diagnostic / Fault Handling Test",
            "Sleep / Quiescent Current Test",
            "Wake-Up Time Test",
            "Firmware Functional Safety Test"
        ];
        const vcu = [
            "Torque Command / Drive Control Test",
            "Regenerative Braking Control Test",
            "Drive Mode Selection Test",
            "CAN Communication Test",
            "Diagnostic / Fault Handling Test",
            "Fail-Safe / Limp-Home Test",
            "Sleep / Quiescent Current Test",
            "Wake-Up Time Test",
            "Firmware Functional Safety Test",
            "Input Voltage Range Verification"
        ];
        const dashboard = [
            "Display Readability Test",
            "Backlight / Brightness Test",
            "Touch / Button Input Test",
            "Indicator / Telltale Lamp Test",
            "Sunlight Readability Test",
            "CAN Communication Test",
            "Sleep / Quiescent Current Test"
        ];
        const sensor = [   // throttle / accelerator / position sensor
            "Output Linearity Test",
            "Hysteresis Test",
            "Deadband / Idle Band Test",
            "Repeatability Test",
            "Return-to-Idle Test",
            "Output Signal Range Test",
            "Contact / Track Resistance Test",
            "Electrical Continuity Test",
            "Supply Voltage Range Test",
            "Actuation Endurance Test",
            "Measurement Accuracy Test"
        ];
        // Automotive road-vehicle electrical-stress standards (ISO 16750-2 / ISO 7637-2).
        const automotive = [
            "Reverse Polarity Protection Test",
            "Jump Start / Over-Voltage Test",
            "Load Dump Test",
            "Supply Voltage Dropout / Crank Profile Test",
            "Superimposed AC Ripple Test",
            "ISO 7637-2 Transient Immunity Test"
        ];
        const isMotor = isMotorProduct(product);
        const isBattery = isBatteryProduct(product);
        const isPower = isPowerProduct(product);
        const isGear = /gear|gearbox|transmission|reduction\s*drive/i.test(String(product || ""));
        const isBMS = /\bbms\b|battery\s*management/i.test(String(product || ""));
        const isVCU = /\bvcu\b|vehicle\s*control|domain\s*controller|\bvcm\b/i.test(String(product || ""));
        // A general ECU (engine / body / telematics control unit) is low-power control
        // electronics: CAN, diagnostics, sleep / wake - not power-conversion tests.
        const isECU = !isVCU && /\becu\b|electronic\s*control\s*(unit|module)|\bbcm\b|body\s*control\s*(unit|module)|telematics\s*control|\btcu\b/i.test(String(product || ""));
        const isDash = /dashboard|instrument\s*cluster|\bcluster\b|display|infotainment|\bhmi\b|telltale|speedometer|odometer|\btft\b|\blcd\b/i.test(String(product || "")) &&
            !/cable|bracket|mount|cover/i.test(String(product || ""));
        // Throttle / pedal / position sensors get the travel tests (deadband,
        // return-to-idle, track resistance). Any OTHER sensor (temperature,
        // current, speed, torque, pressure, side-stand...) used to get that same
        // throttle list too; it now gets only the tests that fit a sensor in general.
        const sensorText = String(product || "");
        // A THROTTLE (or pedal / twist grip) is sprung and has travel, so it also gets
        // deadband, return-to-idle, track resistance and actuation endurance. A plain
        // POSITION sensor (Hall, angle, encoder) measures position with no spring and
        // no throttle to open - it gets the output tests only.
        const isThrottleSensor = !/cable/i.test(sensorText) &&
            /throttle|accelerator|\bapps\b|potentiometer|\bpot\b|twist\s*grip|\bgrip\b|pedal/i.test(sensorText);
        const isPositionSensor = !isThrottleSensor && !/cable/i.test(sensorText) &&
            /position\s*sensor|angle\s*sensor|hall\s*(effect\s*)?sensor|\bencoder\b|resolver|rotary\s*sensor/i.test(sensorText);
        const isOtherSensor = !isThrottleSensor && !isPositionSensor && !/cable/i.test(sensorText) &&
            /\bsensors?\b|load\s*cell|strain\s*gauge|transducer/i.test(sensorText);
        const isSensor = isThrottleSensor || isPositionSensor || isOtherSensor;
        // Power factor / input harmonics apply only to equipment fed from the AC mains.
        const acInput = /charger|\bobc\b|on[\s-]?board\s*charg|power\s*supply|\bsmps\b|rectifier|\bvfd\b|variable\s*frequency|inverter|\bpfc\b/i.test(String(product || ""));
        // A bare cell is tested to IEC 62133 / 62660 / UN 38.3 - no BMS, vehicle
        // IP-immersion, EMC or supply-line transient tests.
        const bareCell = isBareCell(product) && !isBMS;
        // A purely mechanical part (gearbox, helmet, tyre, seat...) gets no electrical tests.
        const mechanical = isMechanicalPart(product) && !isMotor && !isPower && !isBattery && !isDash && !isSensor;
        // The tests SPECIFIC to this product come first: they are what the user
        // actually wants to see. Putting the shared environmental/mechanical set
        // (`general`) first buried the real ones - e.g. a throttle opened with IP,
        // vibration and thermal-shock tests and its own output-linearity /
        // return-to-idle tests only appeared far down the list.
        let specific = [];
        if (isMotor) specific = specific.concat(motor);
        // A gearbox on its own has no drive of its own to load or meter.
        if (isGear) specific = specific.concat(isMotor ? gearbox
            : gearbox.filter((n) => !/variable\s*frequency|power\s*consumption/i.test(n)));
        // A VCU / ECU is control electronics, not a power converter.
        if (isPower && !isVCU && !isECU) specific = specific.concat(acInput ? power
            : power.filter((n) => !/power\s*factor/i.test(n)));
        if (isBMS) specific = specific.concat(bms);
        if (isVCU) specific = specific.concat(vcu);
        if (isECU) specific = specific.concat(electronics, ["Input Voltage Range Verification"]);
        if (isDash) specific = specific.concat(dashboard);
        if (isThrottleSensor) specific = specific.concat(sensor);
        // A position sensor: the same output checks WITHOUT the throttle-only ones
        // (deadband / return-to-idle / track resistance / actuation endurance).
        if (isPositionSensor) specific = specific.concat(sensor.filter((n) =>
            !/deadband|return-to-idle|track\s*resistance|actuation\s*endurance/i.test(n)));
        if (isOtherSensor) specific = specific.concat(
            /load\s*cell|strain\s*gauge|force\s*sensor|weigh/i.test(sensorText)
                ? ["Load Cell Linearity, Hysteresis & Repeatability Test", "Load Cell Creep Test", "Load Cell Zero Balance & Rated Output Test"]
                : [],
            ["Measurement Accuracy Test", "Output Signal Range Test", "Electrical Continuity Test"]);
        if (isBattery && !isBMS) specific = specific.concat(bareCell
            ? battery.filter((n) => !/\bbms\b|ip67|ipx7/i.test(n)) : battery);
        // Any electrical / electronic automotive product gets the ISO 16750 / 7637
        // supply-line stress tests (a purely mechanical gearbox does not).
        // Unknown / non-electrical product (e.g. hand tools): keep only the safe,
        // broadly-applicable environmental & mechanical set already in `general`.
        // Do NOT inject automotive electrical-stress or electronics tests - those
        // wrongly gave reverse-polarity / jump-start / CAN tests to unrelated products.
        const isElectrical = isMotor || isPower || isBattery || isBMS || isVCU || isECU || isDash || isSensor;
        const shared = bareCell
            ? ["Vibration Test", "Mechanical Shock Test", "Thermal Shock Test", "Temperature Cycling Test"]
            : mechanical
                // (a helmet, tyre or gearbox got insulation, Hi-Pot, EMC and surge tests)
                ? general.filter((n) => !isElectricalTest(n))
                : general.concat(isElectrical ? automotive : []);
        // wantSplit lets mergeCurated tell "this product's own tests" apart from the
        // shared environmental/EMC set, so it can rank the AI's results the same way.
        if (wantSplit) return { specific: specific, shared: shared };
        const list = specific.concat(shared);
        return list;
    }

    // Merge the AI's list with the curated master list, de-duplicated by NAME.
    // (Name-based, not template-based, so distinct tests that happen to share a
    // template - e.g. several BMS accuracy tests - are all kept.)
    function mergeCurated(product, aiCases) {
        // Cell-level battery tests (nail, crush, energy density...) belong only in a
        // battery report. Drop them from motor / charger / gearbox reports.
        const isBMS = /\bbms\b|battery\s*management/i.test(String(product || ""));
        const isVCU = /\bvcu\b|vehicle\s*control|domain\s*controller/i.test(String(product || ""));
        const isDash = /dashboard|instrument\s*cluster|\bcluster\b|display|infotainment|speedometer|odometer|\btft\b|\blcd\b/i.test(String(product || ""));
        const isGear = /gear|gearbox|transmission/i.test(String(product || ""));
        // Purely mechanical parts and bare cells: drop the electrical / vehicle-level
        // tests the AI tends to add (EMC, load dump, insulation, BMS, IP immersion...).
        const mechPart = isMechanicalPart(product) && !isMotorProduct(product) &&
            !isPowerProduct(product) && !isBatteryProduct(product);
        const bareCell = isBareCell(product) && !isBMS;
        const nonMotorElec = !isMotorProduct(product) && (isPowerProduct(product) || isBMS || isVCU || isDash ||
            isBatteryProduct(product) || isRelayProduct(product) || isFuseProduct(product) || isConnectorProduct(product));
        const dropBattery =!isBatteryProduct(product) && !isBMS && !isVCU && !isDash &&
            (isMotorProduct(product) || isPowerProduct(product) || isGear || isConnectorProduct(product) ||
             isRelayProduct(product) || isFuseProduct(product) || mechPart);
        // For a MATERIAL or electrical-safety PPE (gloves), drop the device/electrical
        // tests the free AI often returns (IP rating, vibration, EMC, motor dielectric...)
        // - keep only the material / glove and environmental tests.
        const material = isMaterialProduct(product) || isPPEProduct(product);
        const instrument = isInstrumentProduct(product);
        const fitting = isFittingProduct(product);
        const fastener = isFastenerProduct(product);
        const eyewear = isEyewearProduct(product);
        // KEEP an AI-suggested test even when there is no built-in template for
        // it - the AI writes that test's procedure (showAllProceduresAI). The
        // online list is the up-to-date one, so silently deleting the tests we
        // have no template for was throwing away exactly the new ones the user
        // goes online to get. The wrong-CATEGORY guards above still apply, so a
        // camera module still cannot collect battery tests.
        const dropGeneric = false;
        const genStd = (typeof GENERIC_PROCEDURE !== "undefined") ? GENERIC_PROCEDURE.standard : null;
        const isGenericName = (name) => {
            if (typeof pickProcedure !== "function") return false;
            const t = pickProcedure(name);
            return !t || !t.standard || t.standard === genStd;
        };
        const out = [], seen = new Set();
        // Normalise a name for de-dup: drop the word "test", spaces and punctuation,
        // so "Vibration" and "Vibration Test" collapse but distinct tests do not.
        const norm = (s) => String(s).toLowerCase().replace(/\btests?\b/g, "").replace(/[^a-z0-9]/g, "");
        // The AI words the same test differently from our curated name, which slipped
        // past norm() and listed it twice (e.g. "IP Ingress Protection Test" AND
        // "IP Rating (Ingress Protection) Test"). Collapse the families where the
        // wording varies most; anything not listed falls back to norm().
        const FAMILY = [
            [/ingress\s*protection|\bip\s*(rating|code|degree|protection)|\bip[\s-]?(?:[0-6][0-9xk]|x\d)\b/i, "fam-ip"],   // ...x7 too: "IPX7" and "IP67" are one test
            [/linearity/i, "fam-linearity"],
            [/salt\s*(spray|mist|fog)/i, "fam-saltspray"],
            [/thermal\s*shock/i, "fam-thermalshock"],
            [/temperature\s*cycl|thermal\s*cycl/i, "fam-tempcycle"],
            [/humidity|damp\s*heat/i, "fam-humidity"],
            [/mechanical\s*shock|\bshock\s*test/i, "fam-shock"],
            [/hysteresis/i, "fam-hysteresis"],
            [/return[\s-]*to[\s-]*(idle|zero)|idle\s*(return|position)/i, "fam-returnidle"],
            [/deadband|dead\s*band|idle\s*band/i, "fam-deadband"],
            [/repeatab/i, "fam-repeatability"],
            // ISO 11452-2..-8 are eight variants of the SAME immunity test and our
            // procedure text for them is identical, so listing all eight just padded
            // the report with near-duplicate rows. Collapse to one entry.
            [/iso\s*11452|bulk\s*current\s*injection|\bbci\b|stripline|tem\s*cell|absorber\s*method|direct\s*rf\s*power|rf\s*(field\s*)?immunit|radiated\s*immunit|magnetic\s*field\s*immunit/i, "fam-emc-immunity"],
            // "Supply voltage range" and "Operating voltage range" are the same test,
            // as are "Output linearity" and "Position sensor accuracy" - they were
            // listed twice with identical procedures.
            [/(supply|operating|input)\s*voltage\s*(range|variation|window)|voltage\s*range\s*test/i, "fam-voltage-range"],
            [/(position|angle|pedal|throttle)\s*sensor\s*accuracy|(position|angle)\s*accuracy/i, "fam-linearity"],
            // Same measurement, different wording (relay / switch / fuse / busbar).
            [/contact\s*(voltage\s*drop|resistance)/i, "fam-contactres"],
            [/temperature\s*rise\s*at\s*rated\s*current|current[\s-]?carrying\s*capacity/i, "fam-trise-current"],
            [/breaking\s*capacity|interrupting\s*(capacity|rating)/i, "fam-breaking"]
        ];
        const keyFor = (s) => {
            for (const [re, k] of FAMILY) if (re.test(s)) return k;
            return norm(s);
        };
        function add(name, fromCurated) {
            name = String(name || "").trim();
            if (!name) return;
            if (dropBattery && isBatteryTest(name)) return;
            if (material && isDeviceTest(name)) return;
            if (instrument && isVehicleTest(name)) return;
            if (fitting && isFittingDrop(name)) return;
            if ((fastener || eyewear) && isFastenerDrop(name)) return;
            if (mechPart && isElectricalTest(name)) return;
            // Motor-only tests the AI adds to a controller / BMS / pack / relay (no windings or rotor).
            if (nonMotorElec && /winding\s*resist|back[\s-]?emf|cogging|locked[\s-]*rotor|rotor\s*(dynamic|balanc)|magnetic\s*flux|no[\s-]?load\s*current|performance\s*curve/i.test(name)) return;
            if (bareCell && (isElectricalTest(name) || /ip\s*rating|ingress|\bip[x0-9]|immersion/i.test(name))) return;
            // Drop procedure-less (generic) AI tests for these categories - but never
            // drop our own curated tests (they all have real procedures).
            if (dropGeneric && !fromCurated && isGenericName(name)) return;
            const k = keyFor(name);
            if (!k || seen.has(k)) return;
            seen.add(k);
            out.push(name);
        }
        // Split the curated list so we know which tests belong to THIS product and
        // which are the shared environmental/EMC set. Some product categories return
        // a plain, already-tailored array - treat all of that as product-specific.
        const parts = curatedTests(product, true);
        const specificList = Array.isArray(parts) ? parts : parts.specific;
        const sharedList = Array.isArray(parts) ? [] : parts.shared;

        (aiCases || []).forEach((n) => add(n, false));   // AI results first (keeps its wording)
        specificList.forEach((n) => add(n, true));       // then this product's own standard tests
        sharedList.forEach((n) => add(n, true));         // then the shared environmental set

        // Now ORDER by relevance. The AI often returns a wall of EMC/environmental
        // standards first, which pushed the tests that actually characterise the
        // product far down the list (an "EV Motor" opened with 17 EMC/vibration rows
        // and the motor performance tests only started at #18). Rank each test:
        //   0 = this product's own test   1 = other specific test   2 = shared env/EMC
        // and stable-sort, so relative order inside each band is preserved.
        const specKeys = new Set(specificList.map(keyFor));
        const sharedKeys = new Set(sharedList.map(keyFor));
        // Position of each test within the curated product list, so the band of
        // product-specific tests keeps that deliberate order (performance first,
        // ancillary later) instead of whatever order the AI happened to return.
        const specOrder = new Map();
        specificList.forEach((n, i) => { const k = keyFor(n); if (!specOrder.has(k)) specOrder.set(k, i); });
        const SHARED_RE = /iso\s*11452|cispr|iso\s*7637|iso\s*16750|\bemc\b|electromagnet|emission|immunit|susceptib|salt\s*spray|corrosion|thermal\s*shock|temperature\s*cycl|damp\s*heat|humidity|vibration|mechanical\s*shock|\bdrop\s*test\b|ingress|\bip\s*(rating|code)\b|dust\s*(test|ingress)|altitude|solar\s*radiation|mould|fungus|flammab|\bul\s*94\b/i;
        const rankOf = (n) => {
            const k = keyFor(n);
            if (specKeys.has(k)) return 0;               // e.g. IP test IS the point for a cable gland
            if (sharedKeys.has(k) || SHARED_RE.test(n)) return 2;
            return 1;
        };
        const posOf = (n) => { const k = keyFor(n); return specOrder.has(k) ? specOrder.get(k) : 9e9; };
        return out
            .map((n, i) => ({ n: n, i: i, r: rankOf(n), p: rankOf(n) === 0 ? posOf(n) : 0 }))
            .sort((a, b) => (a.r - b.r) || (a.p - b.p) || (a.i - b.i))
            .map((x) => x.n)
            .slice(0, 80);
    }

    // Expose the built-in curated test list so the offline chatbot can answer
    // "test cases for <product>" from the same verified knowledge base.
    window.evTestCasesFor = function (product) { return mergeCurated(product, []); };

    async function listTestCases() {
        const product = prodIn.value.trim();
        if (!product) { setStatus("Enter a product first.", "err"); return; }

        // A new search supersedes any list/write still running for an earlier one
        // (its answers are dropped when they land - see procRun). Procedures
        // already written for this same product are kept and reused.
        procRun++;

        // Fresh search: clear any previously shown procedure / all-view.
        wrap.hidden = true;
        procEl.innerHTML = "";
        if (tcAllEl) { tcAllEl.hidden = true; tcAllEl.innerHTML = ""; }
        save();

        // 1) INSTANTLY: the verified built-in test cases, each with its standard and
        // procedure. The page used to show nothing but spinners until the AI had
        // listed AND written every row - over a minute on the free services.
        const builtin = mergeCurated(product, []);
        renderCases(builtin); save();
        if (builtin.length) showAllProcedures();

        if (!navigator.onLine) {
            setStatus("You are offline - showing the built-in standard test cases (" + builtin.length + ").", "ok");
            return;
        }

        // 2) Then online: the AI adds the tests it knows for this product. Checked
        // against the product that is still typed in when the answer lands.
        const run = procRun;
        setBtnLoading(listBtn, true, "Checking online…");
        setStatus("Showing the " + builtin.length + " standard test cases. Checking online for more tests for this product…");
        try {
            const prompt =
                'List ALL the standard validation TEST CASES that genuinely apply to the product/component "' + product + '". ' +
                "IMPORTANT: give only tests that are actually relevant to THIS specific product, based on ITS OWN applicable standards. " +
                "Do NOT force automotive electrical tests (reverse polarity, load dump, jump start, CAN, EMC) onto a product that is not an " +
                "automotive electrical/electronic component. Choose the right standard family for the product:\n" +
                "- Automotive electrical/electronic parts (motor, controller, charger, BMS, ECU, sensor): ISO 16750, ISO 7637, CISPR 25, " +
                "ISO 11452, ISO 26262, IEC 60068, IEC 60529, ISO 9227.\n" +
                "- Battery / cell / pack: IEC 62133, IEC 62660, AIS-156, GB 38031, UN 38.3.\n" +
                "- Installation materials (adhesive, tape, sheet, film, foam, gasket): ASTM D3330 (peel), ASTM D1002/ISO 4587 (lap shear), " +
                "ASTM D6195 (tack), ASTM D882/ISO 37 (tensile), ASTM D2240 (hardness), ASTM D149 (dielectric), ASTM G154 (weathering), UL 94.\n" +
                "- Mechanical / hand tools / hardware: the relevant ISO/ASTM/IEC mechanical, dimensional, torque, durability and (for " +
                "insulated tools) IEC 60900 standards.\n" +
                "Be comprehensive but ONLY with tests that truly apply. " +
                "Reply with ONLY the test-case names, one per line, no numbering and no descriptions.";
            const r = await aiWithFallback(prompt, "You are a product test-standards expert covering automotive/EV, battery, materials and general mechanical products. List only the test-case names that genuinely apply to the given product, one per line. Do not force automotive electrical tests onto unrelated products.", null, 45000);
            // The product was changed while the AI was answering: this list is
            // for the old one.
            if (run !== procRun) return;
            const cases = mergeCurated(product, parseTestCases(r.text));
            renderCases(cases);
            save();
            // Only the tests with no verified procedure need the AI to write one.
            if (cases.length) { await showAllProceduresAI(); return; }
            setStatus("No test cases found - type one manually below.", "");
        } catch (e) {
            // AI unreachable - the built-in list is already on screen.
            if (run !== procRun) return;
            setStatus("Could not reach the online AI just now - showing the built-in standard test cases (" +
                builtin.length + ").", builtin.length ? "ok" : "err");
        } finally {
            if (run === procRun) setBtnLoading(listBtn, false);
        }
    }

    // ---- show ALL test cases with their built-in standard procedures ----
    function escHtml(x) {
        return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function allProceduresData() {
        const cases = currentCases();
        const noun = ((typeof productNoun === "function" && productNoun(prodIn.value.trim())) || "sample");
        const cap = (s) => { s = String(s).trim(); s = s.charAt(0).toUpperCase() + s.slice(1); if (!/[.!?]$/.test(s)) s += "."; return s; };

        // Build a full acceptance-criteria block (several points + PASS if / FAIL if)
        // tailored to the kind of test, like a real validation report.
        // PRECISE acceptance criteria, built only from what is written for THIS
        // test. The old block added generic lines on loose keywords, with numbers
        // nobody had verified: a salt-spray or vibration test was told to pass
        // "Insulation >= 1 MΩ and Hi-Pot", a thermal-shock test got "no smoke or
        // fire", and any measured test got an invented "±5%".
        function acceptanceBlock(tmpl, test) {
            const t = String(test || "").toLowerCase();
            const generic = !tmpl || (typeof GENERIC_PROCEDURE !== "undefined" && tmpl === GENERIC_PROCEDURE);
            const points = [];

            // An acceptance criterion must not carry an EXAMPLE value: "checked
            // against the limit (e.g. 0.1 Ω)" reads as if 0.1 Ω were the
            // requirement for every product. The example stays in the procedure.
            const noExample = (s) => String(s)
                .replace(/\s*\((?:e\.g\.|for example|typically|usually)[^()]*\)/gi, "")
                .replace(/,?\s*(?:e\.g\.|for example|typically|usually)\s[^,.;]*/gi, "")
                .replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
            const add = (s) => { const x = noExample(plainStep(s)); if (x) points.push(x); };

            // 1. The pass criterion written for this test.
            if (!generic && tmpl.reasonPass) add(tmpl.reasonPass.replace(/\{n\}/g, noun));

            // 2. How the result is judged, taken from the verified procedure itself.
            //    A step that COMPARES or JUDGES first; a step that merely mentions a
            //    "limit" (a test condition such as "raised to the upper limit") is
            //    only used when the procedure has no judging step at all.
            const steps = (!generic && tmpl.procedure && tmpl.procedure[0]) || [];
            const rev = steps.slice().reverse();
            // A CONDITION sentence ("the temperature is ramped to the low limit…")
            // is not a criterion, even though it contains the word "limit".
            const condition = /is placed in|is mounted|is ramped|cycle raises|is set to|is run continuously|is repeated for|is connected to|chamber/i;
            const judge = rev.find((s) => /compar|checked against|judged|\bpass\b|accept|verif|is checked for|are checked for/i.test(s) && !condition.test(s)) ||
                rev.find((s) => /within|limit|inspect|examin/i.test(s) && !condition.test(s));
            if (judge) add(judge.replace(/\{n\}/g, noun));

            // 3. Still working and undamaged afterwards - only for tests that
            //    STRESS the part (not for a measurement such as accuracy or SPL).
            //    "Voltage drop", "drop-out" and "electric shock" are not stresses, and
            //    a destructive abuse test (runaway, nail, crush, burning) is not
            //    expected to leave the part working.
            const ts = t.replace(/voltage\s*drop|drop[\s-]*out|drop[\s-]*off|electric(al)?\s*shock/g, " ");
            // (a helmet's impact liner is single-use: it is not "working normally" after the test)
            const destructive = /runaway|propagat|\bnail|crush|flammab|glow[\s-]*wire|burn|fire|penetrat|breaking|burst|destruct|impact\s*(absorption|attenuation)|ul\s*94/.test(t);
            if (!destructive && /vibrat|shock|thermal\s*(shock|cycl|endurance|ageing|aging|stress)|temperature\s*cycl|humid|damp\s*heat|salt|corros|ingress|\bip\s*\d|\bipx|immersion|dust|endurance|durab|operating\s*life|cycle\s*life|\bdrop|impact|bump|fatigue|weather|\buv\b|ageing|aging|altitude/.test(ts)) {
                points.push("Works normally afterwards, with no damage, cracks, leaks or loose parts.");
            }

            // 4. Safety outcome - only for electrical / battery abuse tests. Not for a
            //    flammability, glow-wire or helmet penetration test, where the part is
            //    meant to be burnt or pierced and the standard's own limit judges it.
            //    Nor for a material's dielectric BREAKDOWN test, where the sample is
            //    punctured on purpose to measure the breakdown voltage.
            if ((/overcharg|over-?discharg|short[\s-]*circuit|\bnail|crush|runaway|propagat|forced\s*discharg|overload|overcurrent|surge|hi-?pot|dielectric\s*strength|dielectric\s*withstand/.test(t) &&
                 !/breakdown/.test(t)) ||
                (/penetrat/.test(t) && !/helmet|shell|striker|visor|water|dust|ingress/.test(t))) {
                points.push("No fire, explosion, smoke or venting.");
            }

            if (!points.length) points.push("Every limit of the governing standard is met.");

            const passIf = "every point above is met.";
            let fail = (!generic && tmpl.reasonFail) || "any point above is not met";
            fail = plainStep(fail.replace(/\{n\}/g, noun).replace(/,?\s*resulting in .*$/i, "")).replace(/\.$/, "");
            fail = fail.charAt(0).toLowerCase() + fail.slice(1);

            return { points: points, passIf: passIf, failIf: fail + "." };
        }

        const rows = cases.map((test) => {
            // An AI-generated procedure for this test wins when one exists.
            const ai = aiProcedures[norm(test)];
            const tmpl = (typeof pickProcedure === "function") ? pickProcedure(test) : null;
            const steps = (ai && ai.steps && ai.steps.length
                ? ai.steps
                : ((tmpl && tmpl.procedure && tmpl.procedure[0])
                    ? tmpl.procedure[0].map((s) => s.replace(/\{n\}/g, noun)) : [])).map(plainStep);
            const standard = (ai && ai.standard) || (tmpl && tmpl.standard) || "—";
            const accept = ai && ai.accept
                ? { points: ai.accept.map(plainStep), passIf: acceptanceBlock(tmpl, test).passIf, failIf: acceptanceBlock(tmpl, test).failIf }
                : acceptanceBlock(tmpl, test);
            return {
                test: test, standard: standard, steps: steps, accept: accept,
                // Waiting ONLY when there is nothing verified to show yet. A test
                // with a built-in procedure is shown at once with its standard;
                // it used to sit on "writing…" until the AI had rewritten it.
                pending: writingProcedures && !ai && !hasRealTemplate(test)
            };
        });

        // (Rows are no longer held back to fill strictly top-to-bottom: that made
        // one slow batch hide every finished row below it.)
        return rows;
    }

    // ---- AI-written procedures -------------------------------------------
    // Procedures and standards come from the AI rather than the built-in
    // templates. Done in BATCHES: one call per ~8 tests, because a separate
    // call for each of ~35 tests would be slow and burn the daily free quota.
    const aiProcedures = {};                       // norm(test) -> {standard, steps, accept}
    let writingProcedures = false;                 // true while the AI is still writing
    let writingRun = -1;                           // the procRun that is writing
    // Bumped whenever the product changes. Batches already in flight belong to
    // the OLD product, so their answers must be thrown away instead of filling
    // the table with procedures written for a product that is no longer typed in.
    let procRun = 0;
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

    // ---- simple, short wording on the Test Cases page ----
    // The built-in steps are written in full standard language (778 steps, median
    // 17 words, some over 40, 299 with bracketed asides) and the acceptance
    // criteria ran to six long sentences. This trims WORDING only: every number,
    // unit, limit and class code stays, because those ARE the test.
    const PLAIN_SWAPS = [
        [/\bin accordance with\b/gi, "per"],
        [/\bapproximately\b/gi, "about"],
        [/\bsubsequently\b/gi, "then"],
        [/\bprior to\b/gi, "before"],
        [/\bin order to\b/gi, "to"],
        [/\butili[sz]es\b/gi, "uses"],
        [/\butili[sz]ed\b/gi, "used"],
        [/\butili[sz]ing\b/gi, "using"],
        [/\butili[sz]e\b/gi, "use"],
        [/\bsufficient\b/gi, "enough"],
        [/\bcommences\b/gi, "starts"],
        [/\bcommenced\b/gi, "started"],
        [/\bcommencing\b/gi, "starting"],
        [/\bcommence\b/gi, "start"],
        [/\bthroughout the\b/gi, "during the"],
        [/\b(is|are) compared with\b/gi, "$1 checked against"],
        [/\bfor the (specified|required) (period|duration)\b/gi, "for the $1 time"],
        [/\bat a steady rate\b/gi, "steadily"],
        [/\bwhere (required|applicable|needed)\b/gi, "if needed"]
    ];

    function plainStep(s) {
        let t = String(s || "").trim();
        // Bracketed asides: an example with no value in it goes; one that carries a
        // value (a digit or a number word) is kept as a short "e.g." so it still
        // reads as an example, not as the requirement. Anything else (conditions,
        // class codes like "(S/F)") is kept as written.
        t = t.replace(/\s*\(([^()]*)\)/g, (m, inner) => {
            const lead = /^\s*(for example|for instance|e\.g\.,?|such as|typically|usually)\s+/i;
            if (!lead.test(inner)) return m;
            if (!/\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|forty|fifty|hundred|thousand|half)\b/i.test(inner)) return "";
            return " (e.g. " + inner.replace(lead, "").trim() + ")";
        });
        PLAIN_SWAPS.forEach(([re, to]) => { t = t.replace(re, to); });
        t = t.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();

        // (No clause is ever cut: the user wants the FULL, accurate procedure in
        // plain words. Only filler wording and example lead-ins are removed above.)
        t = t.replace(/[,;:\s]+$/, "");
        if (t && !/[.!?)]$/.test(t)) t += ".";
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    // True when the app has its own verified procedure and standard for this test
    // (not just the generic fallback text).
    function hasRealTemplate(test) {
        if (typeof pickProcedure !== "function") return false;
        const t = pickProcedure(test);
        const genStd = (typeof GENERIC_PROCEDURE !== "undefined") ? GENERIC_PROCEDURE.standard : null;
        return !!(t && t.standard && t.standard !== genStd && t.procedure && t.procedure[0] && t.procedure[0].length);
    }

    function parseProcedureBlocks(text) {
        const found = {};
        // Blocks look like:  TEST: <name> / STANDARD: <std> / STEP: ... / ACCEPT: ...
        // Models often decorate the labels ("**TEST:**", "1. TEST:", "- STEP:",
        // "### TEST:"), so strip that first or the whole answer is lost.
        const clean = String(text || "").split(/\r?\n/).map((ln) => ln
            .replace(/\*\*|__/g, "")
            .replace(/^\s*(?:#+\s*|[-*•]\s*|\d{1,2}[.)]\s*)+(?=(TEST|STANDARD|STEP|ACCEPT)\b)/i, "")
        ).join("\n");
        clean.split(/\n(?=\s*TEST\s*:)/i).forEach((block) => {
            const nameM = block.match(/^\s*TEST\s*:\s*(.+)$/im);
            if (!nameM) return;
            const stdM = block.match(/^\s*STANDARD\s*:\s*(.+)$/im);
            const steps = [];
            const accept = [];
            block.split(/\r?\n/).forEach((ln) => {
                const s = ln.match(/^\s*STEP\s*:\s*(.+)$/i);
                if (s && s[1].trim()) { steps.push(s[1].trim()); return; }
                const a = ln.match(/^\s*ACCEPT\s*:\s*(.+)$/i);
                if (a && a[1].trim()) accept.push(a[1].trim());
            });
            if (steps.length) {
                found[norm(nameM[1])] = {
                    standard: (stdM && stdM[1].trim()) || "",
                    steps: steps,
                    accept: accept.length ? accept : null
                };
            }
        });
        return found;
    }

    async function fetchAiProcedures(product, cases, onProgress) {
        // Which product this whole run belongs to (see procRun).
        const run = procRun;
        // 8 tests per call, 3 calls in flight. Batching stops this needing ~38
        // round trips; the concurrency stops them being serial. 8 rather than 12
        // because the table completes strictly top-to-bottom, so a smaller batch
        // makes the finished block advance in visible steps rather than one jump.
        // Only the tests the app has NO verified procedure for. Asking the AI to
        // rewrite all ~60 (most of which already have an audited procedure and
        // standard) was 8 calls on a rate-limited free service - the main reason
        // the table sat on "writing 0 of 63" - and a model's standard number is
        // less reliable than the verified one it replaced.
        const BATCH = 6;
        const CONCURRENCY = 4;
        const todo = cases.filter((c) => !aiProcedures[norm(c)] && !hasRealTemplate(c));
        let done = 0;

        const groups = [];
        for (let i = 0; i < todo.length; i += BATCH) groups.push(todo.slice(i, i + BATCH));

        async function runGroup(group) {
            const prompt =
                "For the product: " + product + "\n\n" +
                "Write the STANDARD TEST PROCEDURE for each of these tests:\n" +
                group.map((t, k) => (k + 1) + ". " + t).join("\n") + "\n\n" +
                "For EVERY test output exactly this block and nothing else:\n" +
                "TEST: <the test name, copied exactly as given above>\n" +
                "STANDARD: <the governing standard with its number, e.g. ISO 9227 / ASTM B117 (Salt spray)>\n" +
                "STEP: <first step>\n" +
                "STEP: <next step>\n" +
                "STEP: <next step>\n" +
                "STEP: <next step>\n" +
                "ACCEPT: <an acceptance criterion>\n" +
                "ACCEPT: <another acceptance criterion>\n\n" +
                "Rules:\n" +
                "- 3 to 5 STEP lines per test, in the order they are performed.\n" +
                "- SIMPLE WORDS, SHORT: each STEP is one short sentence (at most 15 words) with only " +
                "the important action and value. Each ACCEPT is a short point (at most 10 words). " +
                "2 or 3 ACCEPT lines.\n" +
                "- Put the REAL test parameters in the steps - voltages, currents, temperatures, " +
                "durations, cycle counts, concentrations, distances - exactly as the standard defines " +
                "them (for example '5% NaCl at 35 degC for 96 hours', '500 V DC for 1 minute').\n" +
                "- Where the value comes from the product's own specification, say 'the specified ...' " +
                "instead of inventing a number.\n" +
                "- Write each step as one plain sentence, no numbering, no markdown, no bold.\n" +
                "- Give the real standard number. Only write 'Product specification' if no public " +
                "standard covers that test.\n" +
                "- Output the blocks back to back with a blank line between them. No other text.";
            try {
                const r = await aiWithFallback(prompt,
                    "You are a test-standards engineer. You write precise, runnable test procedures " +
                    "with the real parameters from the governing standard. Follow the requested " +
                    "output format exactly.", null, 60000);
                const got = parseProcedureBlocks(r.text);
                // The product changed while this batch was in flight: these
                // procedures were written for the old one, so drop them.
                if (run !== procRun) return;
                // Match each answer back to the test we asked about.
                const keys = Object.keys(got);
                const used = new Set(group.map(norm).filter((k) => got[k]));
                group.forEach((t) => {
                    const k = norm(t);
                    if (got[k]) { aiProcedures[k] = got[k]; return; }
                    // Tolerate small wording differences in the echoed name, but only
                    // an unused block whose name is close in length - "vibration test"
                    // must not take the "random vibration test" block of another row.
                    const near = keys.filter((g) => !used.has(g) &&
                        (g.indexOf(k) >= 0 || k.indexOf(g) >= 0) &&
                        Math.min(g.length, k.length) / Math.max(g.length, k.length) >= 0.6);
                    if (near.length === 1) { aiProcedures[k] = got[near[0]]; used.add(near[0]); }
                });
            } catch (e) { /* leave this batch to the built-in text */ }
            done += group.length;
            if (onProgress) onProgress(Math.min(done, todo.length), todo.length);
        }

        // Run the groups with a small pool so several are in flight together.
        let next = 0;
        const workers = [];
        for (let w = 0; w < Math.min(CONCURRENCY, groups.length); w++) {
            workers.push((async function () {
                while (next < groups.length) {
                    const mine = groups[next++];
                    await runGroup(mine);
                }
            })());
        }
        await Promise.all(workers);
        return aiProcedures;
    }

    // Shows the table straight away, then upgrades each row as the AI returns.
    // Waiting for every batch before drawing anything left the page on a spinner
    // for minutes when a service was rate-limited.
    async function showAllProceduresAI() {
        const cases = currentCases();
        if (!cases.length) { setStatus("List the test cases for a product first.", "err"); return; }
        const product = prodIn.value.trim() || "the product";

        // One run at a time: a second click used to start a parallel run, and the
        // first one finishing marked the table done while the second still wrote.
        // A run left over from a product that has since changed does not block the
        // new one: its answers are dropped when they land.
        if (writingProcedures && writingRun === procRun) { setStatus("Still writing the procedures — the table fills in as they arrive.", ""); return; }
        const run = procRun;

        // While writing, rows that have not come back yet show "writing…" so you
        // can watch the table fill in instead of waiting on one big spinner.
        // Nothing to write: every listed test already has a verified procedure.
        const toWrite = cases.filter((c) => !aiProcedures[norm(c)] && !hasRealTemplate(c)).length;
        if (!toWrite) {
            showAllProcedures();
            setStatus("Showing all " + cases.length + " test cases with their standard procedures.", "ok");
            return;
        }

        writingProcedures = true;
        writingRun = run;
        if (tcAllEl) delete tcAllEl.dataset.scrolled;   // scroll once for this run
        showAllProcedures();                       // visible immediately
        setStatus("Showing " + cases.length + " test cases. Writing the procedures for " + toWrite +
                  " new test(s) with AI…");

        const progress = (done, total) => {
            if (run !== procRun) return;       // the product changed meanwhile
            showAllProcedures(true);           // redraw with what has arrived
            setStatus("Writing the standard procedures… " + done + " of " + total +
                      " (the table below fills in as they arrive)");
        };
        const stillMissing = () => cases.filter((c) => !aiProcedures[norm(c)] && !hasRealTemplate(c)).length;

        try {
            await fetchAiProcedures(product, cases, progress);
            // One automatic retry for tests the free service could not write the
            // first time (usually a rate limit), so the table ends up complete
            // without the user having to press anything. Not for a product that
            // has been replaced in the meantime.
            if (run === procRun && stillMissing()) await fetchAiProcedures(product, cases, progress);
        } catch (e) { /* keep whatever arrived */ }

        // Superseded by a newer search: that run owns the flag, table and status.
        if (run !== procRun) {
            if (writingRun === run) writingProcedures = false;
            return;
        }
        writingProcedures = false;
        showAllProcedures(true);
        const missing = stillMissing();
        setStatus(missing
            ? ("Showing all " + cases.length + " test cases. " + missing +
               " could not be written by the AI just now (the free service is busy) and show the general " +
               "procedure - press \"List test cases\" again in a minute to fetch them.")
            : ("Showing all " + cases.length + " test cases with their standards, procedures and acceptance criteria."),
            "ok");
    }

    // redraw = true: a background refresh while procedures arrive. It must not
    // close a single procedure the user opened meanwhile, nor overwrite the status.
    function showAllProcedures(redraw) {
        redraw = redraw === true;
        const data = allProceduresData();
        if (!data.length) { if (!redraw) setStatus("List the test cases for a product first.", "err"); return; }

        // The all-view replaces any single procedure shown.
        if (!redraw) wrap.hidden = true;

        const pendingCount = data.filter((d) => d.pending).length;
        let html = '<div class="tc-all-bar"><b>All test cases &amp; standard procedures (' + data.length + ')</b>' +
            (pendingCount
                ? '<span class="tc-all-writing"><span class="spin"></span> writing ' +
                  (data.length - pendingCount) + ' of ' + data.length + '…</span>'
                : "") +
            '<button type="button" id="tcAllDl">⬇ Download all (Word)</button></div>';
        html += '<div class="tc-all-tablewrap"><table class="tc-all-table">' +
            '<thead><tr>' +
                '<th class="c-no">#</th>' +
                '<th class="c-test">Test Case</th>' +
                '<th class="c-std">Standard</th>' +
                '<th class="c-proc">Procedure</th>' +
                '<th class="c-acc">Acceptance Criteria</th>' +
            '</tr></thead><tbody>';
        const accHtml = (a) =>
            '<ul class="acc-points">' + a.points.map((p) => "<li>" + escHtml(p) + "</li>").join("") + '</ul>' +
            '<div class="acc-pf pass"><b>PASS</b> if ' + escHtml(a.passIf) + '</div>' +
            '<div class="acc-pf fail"><b>FAIL</b> if ' + escHtml(a.failIf) + '</div>';
        data.forEach((d, i) => {
            html += '<tr' + (d.pending ? ' class="tc-row-writing"' : "") + '>' +
                '<td class="c-no">' + (i + 1) + '</td>' +
                '<td class="c-test">' + escHtml(d.test) + '</td>' +
                '<td class="c-std">' + (d.pending
                    ? '<span class="tc-pending"><span class="spin"></span></span>'
                    : escHtml(d.standard)) + '</td>' +
                '<td class="c-proc">' + (d.pending
                    ? '<span class="tc-pending">writing the standard procedure…</span>'
                    : '<ol class="procedure-steps">' +
                      d.steps.map((s) => "<li>" + escHtml(s) + "</li>").join("") + "</ol>") + '</td>' +
                '<td class="c-acc">' + (d.pending
                    ? '<span class="tc-pending">…</span>'
                    : accHtml(d.accept)) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';

        tcAllEl.innerHTML = html;
        tcAllEl.hidden = false;
        document.getElementById("tcAllDl").addEventListener("click", downloadAll);
        // Only scroll on the FIRST draw. The table is redrawn on every batch that
        // comes back, and scrolling each time would yank the page while reading.
        if (!tcAllEl.dataset.scrolled) {
            tcAllEl.dataset.scrolled = "1";
            tcAllEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        if (!redraw) setStatus("Showing all " + data.length + " test cases with their standard procedures.", "ok");
    }

    function downloadAll() {
        // Not half-written: rows still being written would go into the file with
        // placeholder steps that differ from the finished table.
        if (writingProcedures && writingRun === procRun) {
            setStatus("Please wait until all the procedures are written, then download.", "err");
            return;
        }
        const data = allProceduresData();
        if (!data.length) return;
        const product = prodIn.value.trim();
        let body = product ? "<h2>" + escHtml(product) + " - Standard Test Procedures</h2>" : "<h2>Standard Test Procedures</h2>";
        body += "<table border='1' cellspacing='0' cellpadding='5' style=\"border-collapse:collapse;width:100%;font-size:11pt;\">" +
            "<thead><tr style=\"background:#F2F2F2;color:#000;\">" +
                "<th style='width:4%;'>#</th>" +
                "<th style='width:13%;'>Test Case</th>" +
                "<th style='width:15%;'>Standard</th>" +
                "<th style='width:34%;'>Procedure</th>" +
                "<th style='width:34%;'>Acceptance Criteria</th>" +
            "</tr></thead><tbody>";
        const accDoc = (a) =>
            "<ul style='margin:0;padding-left:16px;'>" + a.points.map((p) => "<li>" + escHtml(p) + "</li>").join("") + "</ul>" +
            "<p style='margin:4px 0 0;'><b>PASS</b> if " + escHtml(a.passIf) + "</p>" +
            "<p style='margin:2px 0 0;'><b>FAIL</b> if " + escHtml(a.failIf) + "</p>";
        data.forEach((d, i) => {
            body += "<tr style=\"vertical-align:middle;\">" +
                "<td style='text-align:center;'>" + (i + 1) + "</td>" +
                "<td style='text-align:center;'><b>" + escHtml(d.test) + "</b></td>" +
                "<td style='text-align:center;'>" + escHtml(d.standard) + "</td>" +
                "<td><ol style='margin:0;padding-left:18px;'>" +
                    d.steps.map((s) => "<li>" + escHtml(s) + "</li>").join("") + "</ol></td>" +
                "<td>" + accDoc(d.accept) + "</td>" +
            "</tr>";
        });
        body += "</tbody></table>";
        const doc = wordShell(body);
        const blob = new Blob(["﻿", doc], { type: "application/msword" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (product ? product.replace(/[\\/:*?"<>|]+/g, "").trim() + " - " : "") + "all test procedures.doc";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    function pushToReport() {
        const target = document.getElementById("procedure");
        if (!target) return;
        target.innerHTML = procEl.innerHTML;
        target.querySelectorAll("ol").forEach((o) => o.classList.add("procedure-steps"));
        const t = testIn.value.trim();
        if (t) { const tn = document.getElementById("testName"); if (tn) tn.innerText = t; }
        const std = stdEl.textContent.trim();
        if (std && std !== "—") { const s = document.getElementById("standard"); if (s) s.innerText = std; }
        target.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof saveIfChanged === "function") saveIfChanged();
        if (typeof checkPageFit === "function") checkPageFit();
    }

    // Try the chosen provider; if it errors (bad key, quota, etc.), fall back to
    // the free assistant so the user still gets a result.
    async function aiWithFallback(prompt, system, images, timeoutMs, requireVision) {
        try {
            const text = await aiComplete(prompt, system, false, images, timeoutMs, requireVision);
            // aiComplete answers even when the chosen provider was out of quota,
            // by quietly using the shared free services. That is worth keeping -
            // but not worth hiding.
            if (aiFellBackFrom) return { text: text, fellBack: true, provErr: aiFellBackFrom + " was unavailable" };
            return { text: text, fellBack: false };
        } catch (e) {
            if ((localStorage.getItem("aiProvider") || "free") === "free") throw e;
            const text = await aiComplete(prompt, system, true, images, timeoutMs, requireVision);
            return { text: text, fellBack: true, provErr: e.message };
        }
    }

    // Applies the app's built-in curated standard procedure for this test, if
    // one matches. Used as the reliable fallback when the online fetch fails.
    function applyBuiltin(test, allowGeneric) {
        if (typeof pickProcedure !== "function" || typeof GENERIC_PROCEDURE === "undefined") return false;
        const tmpl = pickProcedure(test);
        if (!tmpl || (!allowGeneric && tmpl === GENERIC_PROCEDURE) || !tmpl.procedure || !tmpl.procedure.length) return false;
        const noun = ((typeof productNoun === "function" && productNoun(prodIn.value.trim())) || "sample");
        const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const steps = tmpl.procedure[0].map((s) => plainStep(s.replace(/\{n\}/g, noun)));
        procEl.innerHTML = '<ol class="procedure-steps">' + steps.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>";
        stdEl.textContent = tmpl.standard || "—";
        titleEl.textContent = "Standard procedure - " + test;
        wrap.hidden = false;
        // Remember what this procedure was fetched FOR, so it can never be
        // pushed into the report under a different product (see the sync box).
        procEl.dataset.forProduct = prodIn.value.trim();
        procEl.dataset.forTest = test;
        save();
        if (syncChk.checked) pushToReport();
        return true;
    }

    async function fetchProcedure(forceOnline) {

        const test = testIn.value.trim();
        if (!test) { setStatus("Enter a test case first.", "err"); return; }

        // Showing one procedure replaces the "all" view.
        if (tcAllEl) { tcAllEl.hidden = true; }

        // Known test -> show the accurate built-in standard procedure straight
        // away (unless the user pressed "Refresh online" to force the AI).
        if (!forceOnline && applyBuiltin(test)) {
            setStatus("Standard procedure loaded.", "ok");
            return;
        }

        // Not a built-in test (or a forced online refresh) -> fetch online.
        if (!navigator.onLine) {
            if (applyBuiltin(test)) setStatus("You are offline - showing the built-in standard procedure.", "ok");
            else setStatus("You are offline - connect to the internet to fetch this procedure.", "err");
            return;
        }

        // Enter in the test box while a fetch runs used to start a second one.
        if (fetchBtn.classList.contains("is-loading")) { setStatus("Still getting the procedure - one moment.", ""); return; }
        setBtnLoading(fetchBtn, true, "Getting…");
        refreshBtn.disabled = true;
        setStatus("Getting the standard procedure online...");

        const product = prodIn.value.trim();
        const runAtStart = procRun;
        const prompt =
            'Give the ACCURATE, standard-compliant test procedure for the "' + test + '" test' +
            (product ? ' on the electric-vehicle (EV) product/component "' + product + '"' : " for an electric-vehicle (EV) component") + ".\n" +
            "First line exactly: 'Standard: <the exact applicable standard(s) and clause if known, e.g. IEC 60529 / IS ...>'.\n" +
            "Then reply with ONLY a numbered list of 4 to 5 steps that follow the OFFICIAL test method defined in " +
            "that standard EXACTLY - the standard's defined test conditions, the correct ACTUAL parameters (real " +
            "levels, durations, temperatures, voltages, water depth, frequencies, g-levels, number of cycles) and " +
            "the pass criteria. Do NOT use generic placeholders and do NOT invent values. Use SIMPLE WORDS and keep " +
            "it SHORT: each step is ONE short sentence (at most 15 words) with only the important action and its " +
            "exact value. No title, no heading, no sub-points.";

        try {
            const r = await aiWithFallback(prompt, "You are an electric-vehicle (EV) test-standards expert. Give the ACCURATE, standard-correct procedure with the real specified parameters. Reply with the standard line, then 4 to 5 numbered steps, each ONE short sentence in simple words. No headings or extra text. Do not invent values - use the actual standard requirements. IMPORTANT: never show your reasoning, thinking or any JSON - output only the final Standard line and the numbered steps.");
            const reply = r.text;

            // The product or test was changed while the AI answered: this answer
            // is for the old one and must not be shown or pushed into the report
            // under the new name.
            if (runAtStart !== procRun || prodIn.value.trim() !== product || testIn.value.trim() !== test) {
                setStatus("The product or test changed while fetching - press Get again for the new one.", "err");
                return;
            }

            let std = "—", body = reply;
            const m = reply.match(/^\s*standard\s*[:\-]\s*(.+)$/im);
            if (m) { std = m[1].trim(); body = reply.replace(m[0], "").trim(); }

            const html = procStepsHtml(body);
            const stepCount = (html.match(/<li>/g) || []).length;

            // Only reject a CLEAR reasoning dump / refusal / JSON leftover - a
            // valid numbered / table / bullet answer must be accepted.
            const head = body.slice(0, 90).toLowerCase();
            const bad =
                !html || stepCount < 2 ||
                /"reasoning"\s*:/.test(reply) ||
                /(i'?m sorry|can'?t provide|cannot provide|i cannot help|as an ai|i am unable)/i.test(reply.slice(0, 220)) ||
                /^(okay[,. ]|ok[,. ]|so[, ]|first,? i|let me|we need to|i need to|let'?s think|alright|hmm|to answer)/i.test(head);

            if (!html || bad) {
                // Online answer unusable (reasoning/refusal) -> built-in, then a
                // general editable procedure as a last resort (never an error).
                if (applyBuiltin(test)) {
                    setStatus("Online answer wasn't usable - showing the built-in standard procedure.", "ok");
                } else if (applyBuiltin(test, true)) {
                    setStatus("No exact standard match for this test - showing a general procedure you can edit. Tip: use Refresh online with Google Gemini for the exact one.", "ok");
                } else {
                    setStatus("Couldn't build a procedure. Switch to Google Gemini (free) in Ask AI → settings, then try again.", "err");
                }
                return;
            }

            procEl.innerHTML = html;
            stdEl.textContent = std;
            titleEl.textContent = "Standard procedure - " + test;
            wrap.hidden = false;
            procEl.dataset.forProduct = prodIn.value.trim();
            procEl.dataset.forTest = test;

            let msg = syncChk.checked ? "Done - the report's Test Procedure was updated." : 'Done. Tick "Auto-update the report" to push it into the report.';
            if (r.fellBack) msg = "Your AI provider errored (" + r.provErr + ") - used the free assistant instead. " + msg;
            setStatus(msg, r.fellBack ? "" : "ok");

            save();
            if (syncChk.checked) pushToReport();
        } catch (e) {
            // Online failed entirely -> built-in, then a general editable one.
            if (applyBuiltin(test)) {
                setStatus("Online fetch failed - showing the built-in standard procedure.", "ok");
            } else if (applyBuiltin(test, true)) {
                setStatus("Online fetch failed - showing a general procedure you can edit.", "ok");
            } else {
                setStatus("Could not fetch: " + e.message, "err");
            }
        } finally {
            setBtnLoading(fetchBtn, false); refreshBtn.disabled = false;
        }
    }

    // Word page setup for the .doc exports.
    //
    // Without an @page rule Word lays the file out on ITS OWN default paper -
    // Letter in a US locale - with default 1-inch margins, so the download did
    // not match the A4 / 20mm geometry of the PDF and the .docx. @page fixes the
    // sheet size and the margin; the wrapper div draws the same single thin
    // frame the on-screen report has, since a real Word page border cannot be
    // expressed in this HTML-based format.
    function wordShell(inner) {
        return "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>" +
            "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>" +
            "<w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->" +
            "<style>" +
            "@page{ size:210mm 297mm; mso-page-orientation:portrait; margin:20mm 20mm 22mm 20mm; }" +
            "body{ font-family:'Times New Roman',Times,serif; font-size:12pt; line-height:1.4; color:#000; }" +
            "table{ border-collapse:collapse; width:100%; }" +
            "td,th{ border:0.75pt solid #000; padding:4pt 5pt; vertical-align:top; }" +
            "h1,h2,h3{ font-family:'Times New Roman',Times,serif; }" +
            ".wframe{ border:0.75pt solid #000; padding:8pt; }" +
            "</style></head><body><div class='wframe'>" + inner + "</div></body></html>";
    }

    // Download as a Word (.doc) file - an HTML document with the Word MIME type,
    // which Microsoft Word opens and edits natively (works fully offline).
    function download() {
        const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // No "Test: procedure" line when the test box is empty (the file name still
        // falls back to "procedure").
        const test = testIn.value.trim();
        const std = stdEl.textContent.trim();
        const doc = wordShell(
            (test ? "<p><b>Test:</b> " + esc(test) + "</p>" : "") +
            (std && std !== "—" ? "<p><b>Standard:</b> " + esc(std) + "</p>" : "") +
            procEl.innerHTML);
        const blob = new Blob(["﻿", doc], { type: "application/msword" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        // Name the file after the particular test case.
        a.download = (test.replace(/[\\/:*?"<>|]+/g, "").trim() || "procedure") + ".doc";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    listBtn.addEventListener("click", listTestCases);
    if (tcAllBtn) tcAllBtn.addEventListener("click", showAllProceduresAI);

    // ---- identify the product FROM AN IMAGE, then list its test cases ----
    // Runner-up guesses from the photo, shown as one-click chips under the box.
    const guessRow = document.getElementById("tcGuessRow");
    const guessBox = document.getElementById("tcGuesses");
    function showGuesses(names) {
        if (!guessRow || !guessBox) return;
        guessBox.innerHTML = "";
        const list = (names || []).filter(Boolean);
        if (!list.length) { guessRow.hidden = true; return; }
        list.forEach((n) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "tc-guess";
            b.textContent = n;
            b.addEventListener("click", () => {
                prodIn.value = n;
                // Tell the page the product changed, so the procedures written
                // for the PREVIOUS product are dropped and not reused.
                prodIn.dispatchEvent(new Event("input", { bubbles: true }));
                save();
                setStatus('Product set to "' + n + '". Click "List test cases".', "ok");
                try { prodIn.focus(); prodIn.select(); } catch (e) { /* ignore */ }
            });
            guessBox.appendChild(b);
        });
        guessRow.hidden = false;
    }

    if (imgBtn && imgFile) {
        imgBtn.addEventListener("click", () => imgFile.click());
        imgFile.addEventListener("change", async () => {
            const f = imgFile.files && imgFile.files[0];
            imgFile.value = "";
            if (!f) return;
            if (f.size > 6 * 1024 * 1024) { setStatus("That image is too big (max 6 MB).", "err"); return; }
            if (!navigator.onLine) { setStatus("You are offline — identifying a product from a photo needs the internet.", "err"); return; }
            // onerror too: an unreadable file used to leave this waiting for ever.
            const rawUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); });
            if (!rawUrl) { setStatus("Could not read that image file — please choose another photo.", "err"); return; }

            setBtnLoading(imgBtn, true, "Identifying…");
            setStatus("Preparing the photo…");
            // Downscale first - sending the full-size photo was the main reason this
            // took so long and often returned nothing at all.
            const dataUrl = await shrinkImage(rawUrl, 900, 0.82);
            // "v257" makes it obvious in the UI whether the browser is running the
            // current script or a cached older one.
            setStatus("Looking at the photo to identify the product… [v257 · Gemini]");
            try {
                // Naming a single product blind is unreliable on a small photo. Make the
                // model LOOK first (shape, connectors, mounting, markings) and then commit
                // - and have it offer 3 ranked candidates so the user can pick when the
                // first guess is wrong. The vocabulary list keeps the answer to names the
                // app has curated test lists for, instead of free-form wording.
                const idPrompt =
                    "You are shown a PHOTOGRAPH of an electric-vehicle (EV) or industrial component.\n\n" +
                    "STEP 1 - look carefully and note: the overall shape and size, any shaft, flange, " +
                    "fins or housing, the connectors and cables, mounting points, and any visible text, " +
                    "labels or markings on the part.\n" +
                    "STEP 2 - decide what the part most likely is, using those visual clues.\n\n" +
                    "Prefer one of these standard names when it fits:\n" +
                    "BLDC Hub Motor, BLDC Motor, PMSM Traction Motor, Induction Motor, Servo Motor, " +
                    "Motor with Gearbox Unit, Gearbox, EV Battery Pack, Battery Module, Lithium Cell, " +
                    "Battery Management System (BMS), Motor Controller, Inverter, DC-DC Converter, " +
                    "On-Board Charger, Vehicle Control Unit (VCU), Instrument Cluster, Throttle Grip, " +
                    "Accelerator Pedal Sensor, Hall Position Sensor, Wiring Harness Connector, Relay, " +
                    "Fuse, Busbar, Cable Gland, Contactor, Charging Gun / Connector, Brake Lever Switch, " +
                    "Handlebar Switchgear, DC Fan, Water Pump, Clamp Meter, Multimeter, Insulating Gloves.\n\n" +
                    "Reply with EXACTLY 3 lines and nothing else - the 3 most likely products, best first, " +
                    "one short product name per line (2-5 words), no numbering, no explanation:\n" +
                    "<most likely>\n<second>\n<third>";
                // 40s per model: there are several vision models to fall through now,
                // and the photo is downscaled, so no single one should need longer.
                const r = await aiWithFallback(idPrompt, "You identify EV and industrial components from photos. Reply with exactly 3 product names, best first, one per line.", [dataUrl], 40000, true);
                // Free models often ignore the format and answer with a sentence, e.g.
                // "The image shows a motorcycle throttle grip." Clean each line back down
                // to a bare product name rather than pasting prose into the product box.
                const tidy = (s) => {
                    let n = String(s || "").trim();
                    // Strip list numbering ("1.", "2)") and bullets only - not the
                    // digits of a real name such as "48V Battery Pack".
                    n = n.replace(/^(?:\s*(?:[*\-•]+|\d{1,2}[.)](?!\d)))+\s*/, "").replace(/\**\s*$/, "");
                    n = n.replace(/^(the\s+)?(image|photo|picture)\s+(shows|depicts|contains|is\s+of)\s*/i, "");
                    n = n.replace(/^(it\s+is|this\s+is|that\s+is|most\s+likely|likely)\s*[:\-]?\s*/i, "");
                    n = n.replace(/^(a|an|the)\s+/i, "");
                    n = n.split(/[.!?;:]/)[0];
                    n = n.replace(/^["'`\s]+|["'`\s]+$/g, "").trim();
                    const words = n.split(/\s+/).filter(Boolean);
                    if (words.length > 6) n = words.slice(0, 6).join(" ");
                    return n;
                };
                const seenG = new Set();
                const guesses = String(r.text || "").split(/\r?\n/)
                    .map(tidy)
                    .filter((n) => {
                        if (!n || n.length < 3) return false;
                        const k = n.toLowerCase();
                        if (seenG.has(k)) return false;
                        seenG.add(k);
                        return true;
                    })
                    .slice(0, 3);
                const name = guesses[0] || "";
                if (!name) { setStatus("Could not identify the product from that image — please type it instead.", "err"); return; }
                prodIn.value = name;
                // A new product: drop procedures written for the previous one and
                // stop any run still writing them (same as typing a new name).
                prodIn.dispatchEvent(new Event("input", { bubbles: true }));
                save();
                // Identify ONLY - the user presses "List test cases" when the name is
                // right. A photo guess is often close-but-wrong, and the wording decides
                // which test list you get, so the runners-up are offered as one-click
                // alternatives instead of making the user retype.
                showGuesses(guesses.slice(1));
                setStatus('Identified: "' + name + '". Check or edit the name, then click "List test cases".', "ok");
                try { prodIn.focus(); prodIn.select(); } catch (e) { /* ignore */ }
            } catch (e) {
                setStatus("Could not identify the product from the image (" + e.message + "). Type the product name instead.", "err");
            } finally {
                setBtnLoading(imgBtn, false);
            }
        });
    }
    prodIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); listTestCases(); } });
    // Clearing the product empties everything that was displayed for it.
    prodIn.addEventListener("input", () => {
        // A different product needs its own procedures written for it, and any
        // batch still in flight for the previous one must not write into them.
        procRun++;
        Object.keys(aiProcedures).forEach((k) => delete aiProcedures[k]);
        // The run for the previous product no longer owns the List button (it
        // only releases it for its own product), so free it for the new one.
        setBtnLoading(listBtn, false);
        if (prodIn.value.trim()) {
            // The table on screen belongs to the previous product: "Download all"
            // would title it with the new name, with the old tests in it.
            if (currentCases().length || (tcAllEl && !tcAllEl.hidden)) {
                renderCases([]);
                if (tcAllEl) { tcAllEl.hidden = true; tcAllEl.innerHTML = ""; }
                setStatus('Product changed - press "List test cases" to show its tests.', "");
                save();
            }
            return;
        }
        renderCases([]);
        wrap.hidden = true; procEl.innerHTML = "";
        if (tcAllEl) { tcAllEl.hidden = true; tcAllEl.innerHTML = ""; }
        showGuesses([]);          // the photo's alternatives no longer apply
        setStatus("");
        save();
    });
    fetchBtn.addEventListener("click", () => fetchProcedure(true));     // online first
    refreshBtn.addEventListener("click", () => fetchProcedure(true));   // online
    downloadBtn.addEventListener("click", download);
    testIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); fetchProcedure(true); } });

    // Editing the procedure or turning on sync updates the report live.
    procEl.addEventListener("input", () => { save(); if (syncChk.checked) pushToReport(); });
    syncChk.addEventListener("change", () => {
        save();
        if (!syncChk.checked) return;
        // Push only a procedure that belongs to the product on screen. Ticking
        // this box used to push whatever the panel still happened to show - the
        // procedure fetched for an EARLIER product - straight over the report's
        // Test Procedure, Test Name and Standard, with no way back.
        if (wrap.hidden || !procEl.innerText.trim()) {
            setStatus("Get a standard procedure first - then it can be pushed into the report.", "");
            return;
        }
        const was = procEl.dataset.forProduct;
        if (was != null && was !== prodIn.value.trim()) {
            setStatus('That procedure was fetched for "' + (was || "another product") +
                '". Get the procedure again for this product before auto-updating the report.', "err");
            return;
        }
        pushToReport();
    });

    // The Product & Test Cases page also opens fresh - no auto-restore of the
    // last product / procedure. (restore stays available but is not called.)

})();

// ===========================================
// TEST RESULT DATA TABLES  (Excel-like; one or many tables)
//
// Every table sits in a .result-table-block with its own tool buttons. The
// button functions take the clicked button (this) and act on that block's
// table, so any number of tables can coexist. "Add another table" clones the
// default block.
// ===========================================

const resultTables = document.getElementById("resultTables");

// One blank table block - used by "Add table" and to reset "New Report".
const RESULT_TABLE_BLOCK = resultTables.innerHTML;

function tblCell(tag, text) {

    const cell = document.createElement(tag);

    cell.contentEditable = "true";

    if (text) cell.textContent = text;

    return cell;

}

// The <table> that belongs to the clicked tool button.
function tblOf(btn) {

    return btn.closest(".result-table-block").querySelector("table");

}

// The table as the user sees it: grid[r][c] is the cell covering row r, column
// c (a merged cell fills every slot it covers). Once cells are merged, a cell's
// DOM position (cellIndex, cells.length) no longer matches the column it sits
// in, which made the table tools add, delete, merge and split the wrong cells.
// Every tool works from this grid instead.
function tblGrid(table) {

    const grid = [];

    Array.from(table.rows).forEach((row, r) => {

        grid[r] = grid[r] || [];

        let c = 0;

        Array.from(row.cells).forEach((cell) => {

            while (grid[r][c]) c++;

            const cs = cell.colSpan || 1, rs = cell.rowSpan || 1;

            for (let dr = 0; dr < rs && r + dr < table.rows.length; dr++) {
                grid[r + dr] = grid[r + dr] || [];
                for (let dc = 0; dc < cs; dc++) grid[r + dr][c + dc] = cell;
            }

            c += cs;

        });

    });

    return grid;

}

// Row and column where a cell starts.
function tblPos(grid, cell) {

    for (let r = 0; r < grid.length; r++) {
        const c = grid[r].indexOf(cell);
        if (c >= 0) return { r: r, c: c };
    }

    return null;

}

function tblWidth(grid) {

    return grid.reduce((w, row) => Math.max(w, row.length), 0);

}

function tblAddRow(btn) {

    const table = tblOf(btn);

    // One cell per column that is SEEN, not per cell in the first row (a merged
    // header cell counts for every column it covers).
    const cols = Math.max(1, tblWidth(tblGrid(table)));

    const row = table.insertRow(-1);

    for (let i = 0; i < cols; i++) {

        // First column auto-numbers the data rows (header excluded).
        const value = i === 0 ? String(table.rows.length - 1) : "";

        row.appendChild(tblCell("td", value));

    }

    checkPageFit();

}

function tblAddColumn(btn) {

    const table = tblOf(btn);

    // Appending to every row lands in the new last column even where a merged
    // cell from the row above covers the old last column.
    Array.from(table.rows).forEach((row, i) => {

        row.appendChild(tblCell(i === 0 ? "th" : "td", ""));

    });

    checkPageFit();

}

function tblDeleteRow(btn) {

    const table = tblOf(btn);

    // Keep the header and at least one data row.
    if (table.rows.length <= 2) return;

    const grid = tblGrid(table);

    // The row the user CLICKED in (a data row of this table); the last row only
    // when nothing in the table is selected. This always deleted the last row,
    // so clicking row 3 of 10 and pressing "− Row" destroyed row 10.
    let r = table.rows.length - 1;
    let col = 0;
    if (lastCell && table.contains(lastCell)) {
        const p = tblPos(grid, lastCell);
        // A header cell is selected: the header is never deleted, and deleting
        // the LAST data row instead would remove a row the user did not pick.
        if (p && p.r === 0) {
            alert("The heading row cannot be deleted. Click in the row you want to remove, then press − Row.");
            return;
        }
        if (p) { r = p.r; col = p.c; }
    }
    const row = table.rows[r];
    const below = table.rows[r + 1] || null;

    const seen = new Set();
    grid[r].forEach((cell, c) => {
        if (!cell || seen.has(cell)) return;
        seen.add(cell);
        const span = cell.rowSpan || 1;
        if (cell.parentElement !== row) {
            // merged down INTO this row from above: it just gets shorter
            cell.rowSpan = Math.max(1, span - 1);
        } else if (span > 1 && below) {
            // starts here and continues below: it moves down a row, one shorter,
            // placed at its own column so the rows below keep all their cells
            cell.rowSpan = span - 1;
            let before = null;
            for (const x of Array.from(below.cells)) {
                const px = tblPos(grid, x);
                if (px && px.c > c) { before = x; break; }
            }
            below.insertBefore(cell, before);
        }
    });

    const hadTarget = !!(lastCell && table.contains(lastCell));
    if (lastCell && row.contains(lastCell)) lastCell = null;
    table.deleteRow(r);
    tblRenumber(table);

    // Keep the selection on the row that moved into this place (or the new last
    // row), so pressing − Row again removes the next row down - not suddenly the
    // last row of the table.
    if (hadTarget && !lastCell) {
        const g = tblGrid(table);
        const rr = Math.min(r, table.rows.length - 1);
        if (rr > 0 && g[rr]) lastCell = g[rr][Math.min(col, g[rr].length - 1)] || null;
    }

    checkPageFit();

}

function tblDeleteColumn(btn) {

    const table = tblOf(btn);
    const grid = tblGrid(table);
    const width = tblWidth(grid);

    if (width <= 1) return;

    // The column the user CLICKED in; the last column only when nothing in the
    // table is selected (it always took the last one, e.g. a filled "Result"
    // column, whichever column was clicked).
    let col = width - 1;
    let selRow = -1;
    if (lastCell && table.contains(lastCell)) {
        const p = tblPos(grid, lastCell);
        if (p) { col = p.c; selRow = p.r; }
    }
    if (lastCell && table.contains(lastCell) && (lastCell.colSpan || 1) <= 1 && tblPos(grid, lastCell) && tblPos(grid, lastCell).c === col) lastCell = null;

    // Remove whatever covers that column, once per cell: a merged cell that
    // spans into it becomes one column narrower instead of being deleted.
    const done = new Set();

    grid.forEach((row) => {
        const cell = row[col];
        if (!cell || done.has(cell)) return;
        done.add(cell);
        if ((cell.colSpan || 1) > 1) cell.colSpan = cell.colSpan - 1;
        else cell.remove();
    });

    // Keep the selection in the column that moved into this place, so a second
    // press removes the next column - not the last one.
    if (selRow >= 0 && !lastCell) {
        const g = tblGrid(table);
        const rowCells = g[selRow] || [];
        lastCell = rowCells[Math.min(col, rowCells.length - 1)] || null;
    }

    checkPageFit();

}

// After a middle row is deleted, a numbered first column (S.No / # / Sl No)
// would read 1, 2, 4. Renumber it - but only cells that hold a plain number or
// nothing, so a first column the user filled with text is never overwritten.
function tblRenumber(table) {
    const head = table.rows[0] && table.rows[0].cells[0];
    if (!head || !/^\s*(s\.?\s*no\.?|sl\.?\s*no\.?|sr\.?\s*no\.?|#|no\.?)\s*$/i.test(head.textContent)) return;
    const grid = tblGrid(table);
    for (let r = 1; r < table.rows.length; r++) {
        const cell = grid[r] && grid[r][0];
        if (!cell || cell.parentElement !== table.rows[r]) continue;
        if (/^\s*\d*\s*$/.test(cell.textContent)) cell.textContent = String(r);
    }
}

// Track the last table cell the user clicked, so Merge/Split know which one.
let lastCell = null;

resultTables.addEventListener("focusin", (e) => {

    if (e.target.matches("td, th")) lastCell = e.target;

});

// Merges the focused cell with the one to its right (like Excel merge).
function tblMergeRight(btn) {

    const block = btn.closest(".result-table-block");

    if (!lastCell || !block.contains(lastCell)) {

        alert("First click the cell in this table you want to merge.");

        return;

    }

    const grid = tblGrid(tblOf(btn));
    const pos = tblPos(grid, lastCell);
    const cs = lastCell.colSpan || 1, rs = lastCell.rowSpan || 1;
    const next = pos && grid[pos.r] ? grid[pos.r][pos.c + cs] : null;

    if (!next) {

        alert("There is no cell to the right to merge into.");

        return;

    }

    // Only a cell of the same height, starting on the same row, can join it -
    // otherwise the table would be torn apart.
    const npos = tblPos(grid, next);

    if (!npos || npos.r !== pos.r || (next.rowSpan || 1) !== rs) {

        alert("The cell to the right is a different height (merged over other rows). Split it first, then merge.");

        return;

    }

    lastCell.colSpan = cs + (next.colSpan || 1);

    // Keep what was typed in the merged cell (it used to be thrown away).
    if (next.textContent.trim()) {
        lastCell.innerHTML = (lastCell.textContent.trim() ? lastCell.innerHTML + " " : "") + next.innerHTML;
    }

    next.remove();

    checkPageFit();

}

// Merges the focused cell with the one directly below it (spans two rows).
function tblMergeDown(btn) {

    const block = btn.closest(".result-table-block");

    if (!lastCell || !block.contains(lastCell)) {

        alert("First click the cell in this table you want to merge.");

        return;

    }

    const table = tblOf(btn);
    const grid = tblGrid(table);
    const pos = tblPos(grid, lastCell);

    const span = lastCell.rowSpan || 1;
    const cs = lastCell.colSpan || 1;

    const belowIndex = pos ? pos.r + span : table.rows.length;

    if (belowIndex >= table.rows.length) {

        alert("There is no row below to merge into.");

        return;

    }

    // The cell seen directly below - by column, not by DOM position.
    const merged = grid[belowIndex] ? grid[belowIndex][pos.c] : null;
    const mpos = merged ? tblPos(grid, merged) : null;

    if (!merged || !mpos || mpos.r !== belowIndex || mpos.c !== pos.c || (merged.colSpan || 1) !== cs) {

        alert("The cell below is a different width (merged across other columns). Split it first, then merge.");

        return;

    }

    // Keep what was typed in the merged cell (it used to be thrown away).
    if (merged.textContent.trim()) {
        lastCell.innerHTML = (lastCell.textContent.trim() ? lastCell.innerHTML + "<br>" : "") + merged.innerHTML;
    }

    lastCell.rowSpan = span + (merged.rowSpan || 1);

    merged.remove();

    checkPageFit();

}

// Splits a merged cell back into single cells (handles column or row merges).
function tblUnmerge(btn) {

    const block = btn.closest(".result-table-block");

    if (!lastCell || !block.contains(lastCell)) {

        alert("First click the merged cell you want to split.");

        return;

    }

    const table = tblOf(btn);

    const colspan = lastCell.colSpan || 1;

    const rowspan = lastCell.rowSpan || 1;

    if (colspan <= 1 && rowspan <= 1) {

        alert("This cell is not merged.");

        return;

    }

    const tag = lastCell.tagName.toLowerCase();

    // Work out where every freed slot is BEFORE changing anything. The new
    // cells go at the columns the merge covered - by column, not DOM position,
    // which put them in the wrong place once the table had other merges.
    const grid = tblGrid(table);
    const pos = tblPos(grid, lastCell);

    lastCell.colSpan = 1;
    lastCell.rowSpan = 1;

    // Same row: the freed columns follow the cell directly.
    let anchor = lastCell;
    for (let dc = 1; dc < colspan; dc++) {
        const cell = tblCell(tag, "");
        anchor.insertAdjacentElement("afterend", cell);
        anchor = cell;
    }

    // Rows below: a full set of cells, placed before the first cell of that row
    // that starts to the right of the merge.
    for (let dr = 1; dr < rowspan; dr++) {

        const r = pos.r + dr;
        const row = table.rows[r];
        if (!row) break;

        let before = null;
        for (const x of Array.from(row.cells)) {
            const p = tblPos(grid, x);
            if (p && p.c > pos.c) { before = x; break; }
        }

        for (let dc = 0; dc < colspan; dc++) {
            row.insertBefore(tblCell(r === 0 ? "th" : "td", ""), before);
        }

    }

    checkPageFit();

}

// Removes the whole table block. The table is optional - you can remove them
// all and use only sentences, then bring one back with "Add another table".
function tblRemove(btn) {

    btn.closest(".result-table-block").remove();

    checkPageFit();

}

// Adds a fresh blank table below the existing ones.
function addResultTable() {

    const holder = document.createElement("div");

    holder.innerHTML = RESULT_TABLE_BLOCK;

    Array.from(holder.children).forEach((child) => resultTables.appendChild(child));

    checkPageFit();

}

// A movable sentence block, so text can sit before or after any table.
const RESULT_NOTE_BLOCK =
    '<div class="result-note-block">' +
        '<div class="table-tools">' +
            '<button type="button" class="tbl-remove" onclick="noteRemove(this)">&times; Remove text</button>' +
        '</div>' +
        '<div class="result-note editor" contenteditable="true" ' +
            'data-placeholder="Write a sentence here..."></div>' +
    '</div>';

function addResultNote() {

    const holder = document.createElement("div");

    holder.innerHTML = RESULT_NOTE_BLOCK;

    Array.from(holder.children).forEach((child) => resultTables.appendChild(child));

    checkPageFit();

}

function noteRemove(btn) {

    btn.closest(".result-note-block").remove();

    checkPageFit();

}

// Move a text or table block up/down to reorder it in the Test Result flow.
function blockUp(btn) {

    const block = btn.closest(".result-note-block, .result-table-block");

    const prev = block.previousElementSibling;

    if (prev) {

        block.parentNode.insertBefore(block, prev);

        checkPageFit();

    }

}

function blockDown(btn) {

    const block = btn.closest(".result-note-block, .result-table-block");

    const next = block.nextElementSibling;

    if (next) {

        block.parentNode.insertBefore(next, block);

        checkPageFit();

    }

}

// ===========================================
// OPTIONAL APPROVAL SECTION
// ===========================================

const approvalCard = document.getElementById("approvalCard");
const approvalRestore = document.getElementById("approvalRestore");

// Applies the kept/removed state; persisted so a reload remembers it.
// removedNow: true / false to set the state; left out = use the saved draft's.
function applyApprovalState(removedNow) {

    const removed = removedNow === undefined ? localStorage.getItem("approvalRemoved") === "1" : !!removedNow;

    approvalCard.style.display = removed ? "none" : "";

    approvalRestore.style.display = removed ? "" : "none";

    // The section right above the signature table closes on that table's top
    // line, so it must not draw a bottom line of its own (a double line).
    const before = document.getElementById("recommendationCard") ||
        document.getElementById("conclusion").closest(".section-card");

    // Never - not even with the table removed. Asked for: the line above
    // Prepared By belongs to the signature table, so removing the table takes
    // that line with it instead of leaving a rule stranded across the page.
    // The page frame closes the foot of the report on its own.
    if (before) before.style.borderBottom = "none";

}

// Removed / added back with the rest of the report: saved by the auto-save like
// any other change (so a blank start-up screen never writes it into the draft).
function removeApproval() {

    applyApprovalState(true);

    saveIfChanged();

    checkPageFit();

}

function addApproval() {

    applyApprovalState(false);

    saveIfChanged();

    checkPageFit();

}

// ----- Observation section: optional (can be removed / added back) -----

function applyObservationState(removedNow) {

    const removed = removedNow === undefined ? localStorage.getItem("observationRemoved") === "1" : !!removedNow;

    const card = document.getElementById("observationCard");
    const restore = document.getElementById("observationRestore");

    if (card) card.style.display = removed ? "none" : "";
    if (restore) restore.style.display = removed ? "" : "none";

}

function removeObservation() {

    applyObservationState(true);

    saveIfChanged();

    checkPageFit();

}

function addObservation() {

    applyObservationState(false);

    saveIfChanged();

    checkPageFit();

}

// ===========================================
// STARTUP
//
// The report deliberately starts blank. An earlier version restored the
// saved draft automatically, which made last week's data look like it was
// part of a fresh report. Use "Load Draft" to bring it back on purpose.
// ===========================================

// ===========================================
// PAGE FRAME
// Wrap each page's content in a bordered .page-inner so the whole page has a
// frame with margin outside it (paper edge to frame) and inside it (frame to
// content), matching the reference report.
// ===========================================

function wrapPageFrames() {

    document.querySelectorAll(".page").forEach((page) => {

        if (page.querySelector(":scope > .page-inner")) return;   // already wrapped

        const inner = document.createElement("div");
        inner.className = "page-inner";

        // Content lives in an inner ".page-fit" that checkPageFit can scale down
        // so the page always fits - without shrinking the frame/border (which
        // stays on .page-inner).
        const fit = document.createElement("div");
        fit.className = "page-fit";

        while (page.firstChild) fit.appendChild(page.firstChild);

        inner.appendChild(fit);
        page.appendChild(inner);

    });

}

wrapPageFrames();

window.onload=function(){

setupDateFields();

// The page opens FRESH and EMPTY on every load. The last saved work is NOT
// auto-restored - the user brings it back on purpose with the "Load Draft"
// button. (Saved data stays safe in localStorage; nothing is cleared here.)

// A blank report shows every section - a section removed in the last draft
// comes back only with that draft (Load Draft / My Reports -> Open).
applyApprovalState(false);
applyObservationState(false);

initPhotoDraw("before");

initPhotoDraw("after");

initPhotoCrop("before");

initPhotoCrop("after");

initLogoCrop();

// The RCA logo's own pan / zoom, so a saved position survives a reload.
rcaLogoCropLoad();

checkPageFit();

// Always open on the Home page when the site/link is opened - EXCEPT straight
// after "Open" on a saved report, which reloads the app to restore it. Without
// this one-shot marker that reload dropped you back on Home and the report you
// asked for was never shown. Must be the LAST view decision on startup.
// What a blank report looks like, so leaving the page never saves a blank
// report over the draft (see saveIfChanged).
blankReportSig = reportSignature();

// Straight after My Reports -> Open: load the report that was opened.
try {
    if (localStorage.getItem("loadDraftOnce")) {
        localStorage.removeItem("loadDraftOnce");
        loadDraft(false);
    }
} catch (e) { /* ignore */ }

let startView = "home";
try {
    const gotoOnce = localStorage.getItem("gotoViewOnce");
    if (gotoOnce) { localStorage.removeItem("gotoViewOnce"); startView = gotoOnce; }
} catch (e) { /* ignore */ }
showView(startView);

// From here on, a change on the blank screen starts a fresh draft (bindFreshDraft).
appStarted = true;

};


// ===========================================
// AI ASSISTANT
//
// A ChatGPT-style side panel that answers inside the page. By default it uses
// a FREE, keyless, no-login public AI backend (Pollinations) - all it needs is
// an internet connection. If the user chooses to paste their own paid OpenAI
// key, that is used instead for stronger answers. Either way the chat stays in
// this panel; it never touches the report, the draft, or the PDF, and the rest
// of the tool keeps working fully offline.
// ===========================================

(function () {

    const panel = document.getElementById("aiPanel");
    const toggle = document.getElementById("aiToggle");
    const closeBtn = document.getElementById("aiClose");
    const settingsBtn = document.getElementById("aiSettingsBtn");
    const clearBtn = document.getElementById("aiClear");
    const downloadBtn = document.getElementById("aiDownload");
    const settings = document.getElementById("aiSettings");
    const keyInput = document.getElementById("aiKey");
    const modelInput = document.getElementById("aiModel");
    const providerSel = document.getElementById("aiProvider");
    const keyRow = document.getElementById("aiKeyRow");
    const keyHelp = document.getElementById("aiKeyHelp");
    const saveKeyBtn = document.getElementById("aiSaveKey");
    const messages = document.getElementById("aiMessages");
    const input = document.getElementById("aiInput");
    const sendBtn = document.getElementById("aiSend");
    const fileInput = document.getElementById("aiFile");
    const attachBtn = document.getElementById("aiAttachBtn");
    const attachBar = document.getElementById("aiAttachBar");

    // A photo/file picked but not sent yet; and the one riding the live request.
    let pendingAttachment = null;
    let currentAttachment = null;
    const MAX_ATTACH = 5 * 1024 * 1024;   // 5 MB
    const TEXT_EXT = /\.(txt|csv|tsv|md|json|log|xml|ya?ml|ini)$/i;

    const inline = document.getElementById("aiInline");

    const DEFAULT_MODEL = "gpt-4o-mini";

    // Gives the model enough context to answer doubts about this specific form.
    const SYSTEM_PROMPT =
        "You are a helpful, concise assistant built into the BNC Motors EV " +
        "Testing and Validation app, used by test and quality engineers.\n\n" +
        "ANSWER EVERY QUESTION THE USER ASKS. You are a general assistant, not " +
        "a restricted one. If the user asks about something outside this app - " +
        "AI, general knowledge, a standard, a calculation, an email, anything - " +
        "just answer it helpfully and briefly. NEVER reply that you only handle " +
        "test reports, never say a topic is outside your scope, and never " +
        "refuse a normal question. Simply help.\n\n" +
        "The app has five pages:\n" +
        "1. Home - overview and quick links.\n" +
        "2. Product & Test Cases - type a product (or identify it from a photo) " +
        "to list its applicable test cases, each with a standard procedure and " +
        "the governing standard; a test can be pushed into the report.\n" +
        "3. Product Validation Test Report - the main report: header " +
        "(Doc.Rev.No, Report No., Report Date), one information block " +
        "(Product, Application, Test Name, Start/End Date in DD/MM/YYYY, " +
        "Sample Type, Drawing/Part No., Supplier, No. of Samples, Standard), " +
        "Product Details (the specification list of the part), Test Objective " +
        "(Auto button), Test Equipment & Setup, Test Procedure (Manual button " +
        "gives an A / a. b. c. outline, Auto button writes short " +
        "condition-based steps, Columns button lays the blocks side by side), " +
        "Test Photographs (before/after " +
        "with editable captions), Observation (a 'Correct English' button " +
        "converts Tanglish and typos into report English), Test Result " +
        "(PASS/FAIL), Conclusion (Auto), Recommendation and the Prepared / " +
        "Reviewed / Issued By signature table. It " +
        "exports a 2-page A4 PDF.\n" +
        "4. RCA Report - a full 8D / 5-Why / Fishbone root cause report, mostly " +
        "filled by AI, downloadable as a real Word .docx or PDF.\n" +
        "5. Supplier 8D Evaluation - upload a supplier's 8D (image, PDF, Word " +
        "or pasted text) and get a short bullet evaluation, or a plain summary " +
        "if the document is not an 8D.\n\n" +
        "Built-in test types include IPX7, IPX6, IP6K9K, vibration, thermal " +
        "shock, salt spray, drop, overcharge, over-discharge, short circuit and " +
        "cycle life, plus motor, battery, power-electronics, sensor, connector " +
        "and instrument test sets. Keep answers short and " +
        "practical. The user often writes in Tanglish (Tamil written with " +
        "English letters) or mixes Tamil and English, for example 'ipdi', " +
        "'epdi', 'enna', 'panrathu', 'evlo'. Always understand the Tanglish " +
        "input, but ALWAYS reply in clear, simple English only - never in " +
        "Tamil script and never in Tanglish, even if the question is in " +
        "Tanglish. Keep the English plain and suitable for a test report. " +
        "FORMATTING: reply in clean Markdown like ChatGPT. Use short '##' " +
        "sub-headings to group ideas, '- ' bullet points for lists, '1.' " +
        "numbered steps for sequences, **bold** for key terms, and a Markdown " +
        "table (| Column | Column |, then a |---|---| separator row, then the " +
        "rows) whenever you compare items or list parameters with values. Keep " +
        "each bullet on one line and each table cell on a single line (never " +
        "wrap a cell across lines). Do not repeat the same point twice. Prefer " +
        "well-structured points over long paragraphs.";

    // Conversation history sent to the API (excludes the system prompt, which
    // is prepended on each call).
    const history = [];

    let busy = false;

    // The chat is kept in localStorage so it survives a page reload and the
    // "New Report" button. It is cleared only by the "Clear chat" button.
    const HISTORY_KEY = "aiHistory";

    // The chat shares ONE storage quota with the report draft, its photos and
    // every saved report, and nothing here was ever trimmed: a few attached logs
    // (up to 20,000 characters each) were enough to fill it, after which saving
    // a report failed with a message that never mentioned the chat. Keep the
    // most recent turns, and store older attachment turns without the file's
    // contents - the same rule aiContext() uses for what is sent.
    const MAX_STORED_TURNS = 80;

    function historyForStorage() {
        const keep = history.slice(-MAX_STORED_TURNS);
        let lastWithFile = -1;
        keep.forEach((m, i) => { if (m.bare != null) lastWithFile = i; });
        return keep.map((m, i) => (m.bare != null && i !== lastWithFile)
            ? Object.assign({}, m, { content: m.bare })
            : m);
    }

    function saveHistory() {

        try {

            localStorage.setItem(HISTORY_KEY, JSON.stringify(historyForStorage()));

        } catch (e) { /* storage full or blocked - keep the in-memory chat */ }

    }

    // ---------- settings (optional paid key) ----------

    keyInput.value = localStorage.getItem("aiKey") || "";
    modelInput.value = localStorage.getItem("aiModel") || "";
    providerSel.value = localStorage.getItem("aiProvider") || "free";

    // Gemini and OpenRouter each keep their own key, so BOTH can be set at once
    // and the app picks the right one per job.
    const gemKeyInput = document.getElementById("aiGeminiKey");
    const gemModelInput = document.getElementById("aiGeminiModel");
    const gemState = document.getElementById("aiGeminiState");
    const orKeyInput = document.getElementById("aiOpenRouterKey");
    const orModelInput = document.getElementById("aiOpenRouterModel");
    const orState = document.getElementById("aiOpenRouterState");
    const testKeysBtn = document.getElementById("aiTestKeys");

    if (gemKeyInput) gemKeyInput.value = localStorage.getItem("aiGeminiKey") || "";
    if (gemModelInput) gemModelInput.value = localStorage.getItem("aiGeminiModel") || "";
    if (orKeyInput) orKeyInput.value = localStorage.getItem("aiOpenRouterKey") || "";
    if (orModelInput) orModelInput.value = localStorage.getItem("aiOpenRouterModel") || "";

    function showKeyStates() {
        if (gemState) {
            gemState.textContent = (localStorage.getItem("aiGeminiKey") || "").trim()
                ? "✔ Using your own Gemini key."
                : "Using the built-in key.";
        }
        if (orState) {
            orState.textContent = (localStorage.getItem("aiOpenRouterKey") || "").trim()
                ? "✔ Using your own OpenRouter key."
                : "Using the built-in key.";
        }
    }
    showKeyStates();

    function haveKey() {

        return !!(localStorage.getItem("aiKey") || "").trim();

    }

    // The OpenAI row is the only one that still depends on the dropdown; the two
    // free keys are always shown because either or both may be filled in.
    function applyProviderUI() {

        const p = providerSel.value;

        keyRow.hidden = (p !== "openai");

        if (p === "openai") {
            keyHelp.innerHTML = 'Paid. Get a key at ' +
                '<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a>.';
            modelInput.placeholder = "gpt-4o-mini";
        }

    }

    applyProviderUI();
    providerSel.addEventListener("change", applyProviderUI);

    // Checks each key against its real API so a wrong paste is caught here
    // rather than showing up later as a failed answer.
    if (testKeysBtn) testKeysBtn.addEventListener("click", async () => {
        testKeysBtn.disabled = true;
        const origLabel = testKeysBtn.textContent;
        testKeysBtn.textContent = "Testing…";

        // Which key is actually being tested matters: with an empty box this
        // tests the BUILT-IN key, and reporting a plain "✔ works" let a user
        // whose paste had failed believe their own key was fine.
        const gOwn = !!(gemKeyInput && gemKeyInput.value.trim());
        const gKey = gOwn ? gemKeyInput.value.trim() : GEMINI_KEY;
        const gModel = (gemModelInput && gemModelInput.value.trim()) || GEMINI_MODEL;
        if (gemState) gemState.textContent = "Testing…";
        // No key in the browser on the hosted site: the site's server key is tested.
        const gWhose = gOwn ? "Your Gemini key" : gKey ? "The built-in Gemini key" : "The site's server Gemini key";
        try {
            const r = await geminiFetch(gModel, gKey,
                { contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }] },
                aiSignal(30000));      // never leave the button stuck on "Testing…"
            if (!r) gemState.textContent = "✖ No Gemini key entered (this copy has no built-in key).";
            else if (r.ok) gemState.textContent = "✔ " + (gOwn ? "Your Gemini key works" : "No key entered — " + gWhose.charAt(0).toLowerCase() + gWhose.slice(1) + " works") + " (" + gModel + ").";
            else {
                let why = r.status;
                try { const e = await r.json(); if (e.error && e.error.message) why = String(e.error.message).split("\n")[0]; } catch (x) { /* keep */ }
                gemState.textContent = "✖ " + gWhose + ": " + why;
            }
        } catch (e) { gemState.textContent = "✖ Gemini: could not reach the service."; }

        // Same as Gemini above: say WHICH key was tested.
        const oOwn = !!(orKeyInput && orKeyInput.value.trim());
        const oKey = oOwn ? orKeyInput.value.trim() : OPENROUTER_KEY;
        const oModel = (orModelInput && orModelInput.value.trim()) || OPENROUTER_MODELS[0];
        if (orState) orState.textContent = "Testing…";
        const oWhose = oOwn ? "Your OpenRouter key" : oKey ? "The built-in OpenRouter key" : "The site's server OpenRouter key";
        try {
            const r2 = await openRouterFetch(oKey,
                { model: oModel, messages: [{ role: "user", content: "Reply with exactly: OK" }] },
                aiSignal(30000));
            if (!r2) orState.textContent = "✖ No OpenRouter key entered (this copy has no built-in key).";
            else if (r2.ok) orState.textContent = "✔ " + (oOwn ? "Your OpenRouter key works" : "No key entered — " + oWhose.charAt(0).toLowerCase() + oWhose.slice(1) + " works") + " (" + oModel.split("/").pop() + ").";
            else {
                let why2 = r2.status;
                try { const e2 = await r2.json(); if (e2.error && e2.error.message) why2 = String(e2.error.message).split("\n")[0]; } catch (x) { /* keep */ }
                orState.textContent = "✖ " + oWhose + ": " + why2;
            }
        } catch (e) { orState.textContent = "✖ OpenRouter: could not reach the service."; }

        testKeysBtn.disabled = false;
        testKeysBtn.textContent = origLabel;
    });

    saveKeyBtn.addEventListener("click", () => {

        const provider = providerSel.value;
        localStorage.setItem("aiProvider", provider);

        const key = keyInput.value.trim();
        if (key) { localStorage.setItem("aiKey", key); }
        else { localStorage.removeItem("aiKey"); }

        const model = modelInput.value.trim();
        if (model) { localStorage.setItem("aiModel", model); }
        else { localStorage.removeItem("aiModel"); }

        // Both free keys are saved together - neither replaces the other.
        const store = (id, el) => {
            const v = el ? el.value.trim() : "";
            if (v) localStorage.setItem(id, v); else localStorage.removeItem(id);
            return v;
        };
        const gKey = store("aiGeminiKey", gemKeyInput);
        store("aiGeminiModel", gemModelInput);
        const oKey = store("aiOpenRouterKey", orKeyInput);
        store("aiOpenRouterModel", orModelInput);

        showKeyStates();
        settings.hidden = true;

        let msg;
        if (provider === "openai") {
            msg = key ? "Saved. OpenAI ChatGPT will now be used."
                      : "No OpenAI key entered, so the free services will be used.";
        } else if (provider === "gemini") {
            msg = "Saved. Google Gemini is used first; if it is busy the other free service answers instead.";
        } else if (provider === "openrouter") {
            msg = "Saved. OpenRouter is used first; if it is busy Google Gemini answers instead.";
        } else {
            const both = gKey && oKey;
            msg = "Saved. Both services are used together — photos and scanned PDFs go to " +
                "Google Gemini, chat and text go to OpenRouter, and each backs up the other. " +
                (both ? "Both of your own keys are active."
                      : (gKey ? "Your Gemini key is active; OpenRouter uses the built-in key."
                              : (oKey ? "Your OpenRouter key is active; Gemini uses the built-in key."
                                      : "Both are using the built-in keys.")));
        }
        addMessage("info", msg);

    });

    settingsBtn.addEventListener("click", () => {

        settings.hidden = !settings.hidden;
        if (!settings.hidden) refreshPuterStatus();

    });

    // ---------- Puter free-AI account (email only) ----------
    const puterStatus = document.getElementById("puterStatus");
    const puterSignInBtn = document.getElementById("puterSignIn");
    const puterChangeBtn = document.getElementById("puterChange");
    const puterSignOutBtn = document.getElementById("puterSignOut");

    function puterReady() {
        return window.puter && window.puter.auth && typeof window.puter.auth.signIn === "function";
    }

    async function refreshPuterStatus() {
        if (!puterStatus) return;
        if (!puterReady()) {
            // Opened straight from disk, Puter is deliberately not loaded (it would
            // block the whole page with an "Unsupported Protocol" modal). Say so
            // plainly instead of blaming the internet connection.
            const isFile = location.protocol === "file:";
            puterStatus.textContent = isFile
                ? "Not used when the page is opened directly from a file. The app uses Google Gemini instead, which works fine here."
                : "Unavailable (needs an internet connection to load).";
            [puterSignInBtn, puterChangeBtn, puterSignOutBtn].forEach((b) => { if (b) b.hidden = true; });
            return;
        }
        let signedIn = false;
        try { signedIn = !!(window.puter.auth.isSignedIn && window.puter.auth.isSignedIn()); } catch (e) { /* ignore */ }
        if (signedIn) {
            let who = "";
            try {
                const u = await window.puter.auth.getUser();
                who = (u && (u.email || u.username)) || "";
            } catch (e) { /* ignore */ }
            puterStatus.textContent = "Signed in" + (who ? " as " + who : "") + ". The chatbot uses this free account.";
            if (puterSignInBtn) puterSignInBtn.hidden = true;
            if (puterChangeBtn) puterChangeBtn.hidden = false;
            if (puterSignOutBtn) puterSignOutBtn.hidden = false;
        } else {
            puterStatus.textContent = "Not signed in. Sign in once with an email (no payment) for reliable free answers.";
            if (puterSignInBtn) puterSignInBtn.hidden = false;
            if (puterChangeBtn) puterChangeBtn.hidden = true;
            if (puterSignOutBtn) puterSignOutBtn.hidden = true;
        }
    }

    async function puterSignIn() {
        if (!puterReady()) { refreshPuterStatus(); return; }
        try {
            callFreeAI._puterAsked = false;      // let the chat use Puter again
            await window.puter.auth.signIn();
        } catch (e) { /* user closed the window */ }
        refreshPuterStatus();
    }

    if (puterSignInBtn) puterSignInBtn.addEventListener("click", puterSignIn);
    if (puterChangeBtn) puterChangeBtn.addEventListener("click", async () => {
        // Change email = sign out of the current account, then sign in again.
        if (!puterReady()) { refreshPuterStatus(); return; }
        try { await window.puter.auth.signOut(); } catch (e) { /* ignore */ }
        await puterSignIn();
    });
    if (puterSignOutBtn) puterSignOutBtn.addEventListener("click", async () => {
        if (!puterReady()) { refreshPuterStatus(); return; }
        try { await window.puter.auth.signOut(); } catch (e) { /* ignore */ }
        refreshPuterStatus();
    });

    refreshPuterStatus();

    // ---------- open / close ----------

    function openPanel() {

        panel.classList.add("open");

        panel.setAttribute("aria-hidden", "false");

        if (!messages.dataset.greeted) {

            messages.dataset.greeted = "1";

            addMessage("bot",
                "Hi! Ask me anything — the report, test cases, standards, RCA, " +
                "supplier 8D, or any other question you have. You can type in " +
                "English or Tanglish. This is free and needs no login — just an " +
                "internet connection.");

        }

        setTimeout(() => input.focus(), 260);

    }

    function closePanel() {

        panel.classList.remove("open");

        panel.setAttribute("aria-hidden", "true");

    }

    toggle.addEventListener("click", () => {

        panel.classList.contains("open") ? closePanel() : openPanel();

    });

    closeBtn.addEventListener("click", closePanel);

    // ---------- messages ----------

    // QUOTES MATTER HERE. This escaped text is fed to formatMarkdown(), which
    // builds real HTML attributes from it (the link rule below). Escaping only
    // < and > left a reply able to close an href and add its own event handler -
    // and because chat turns are re-rendered on every load and can be pushed
    // into a report field, that handler persisted into the draft and the export.
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Turns the assistant's plain/markdown answer into simple, safe HTML so the
    // chat AND the inserted field keep the same look: line breaks, **bold**,
    // numbered lists (1. 2. 3.) and bullet lists (-, *).
    // ChatGPT-style Markdown -> HTML: headings, bold/italic, inline code,
    // fenced code blocks, bullet & numbered lists, GFM tables, blockquotes,
    // horizontal rules and links. Self-contained (no external library).
    function formatMarkdown(raw) {

        // Inline spans applied to already-escaped text.
        function inline(s) {
            // inline code first, so * or _ inside code is left alone
            s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
            // bold before italic
            s = s.replace(/\*\*([^*]+?)\*\*/g, "<b>$1</b>");
            s = s.replace(/__([^_]+?)__/g, "<b>$1</b>");
            // italic *x* / _x_ (avoid matching leftover ** or list bullets)
            s = s.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>");
            s = s.replace(/(^|[^_])_(?!_)([^_\n]+?)_(?!_)/g, "$1<i>$2</i>");
            // links [text](url)
            // The URL may not contain a quote, an angle bracket or a backtick:
            // this is interpolated straight into an href attribute, so anything
            // that can end the attribute must never reach it (escapeHtml above
            // is the first guard, this is the second).
            s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s"'<>`]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
            return s;
        }

        function splitRow(t) {
            return t.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
        }
        const isTableSep = (t) => /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(t) && t.indexOf("-") >= 0;

        const lines = escapeHtml(raw).split(/\r?\n/);
        let html = "";
        let list = null;
        const closeList = () => { if (list) { html += "</" + list + ">"; list = null; } };

        let i = 0;
        while (i < lines.length) {

            const t = lines[i].trim();

            // blank line
            if (t === "") { closeList(); i++; continue; }

            // fenced code block ```
            if (/^```/.test(t)) {
                closeList();
                i++;
                let code = "";
                while (i < lines.length && !/^```/.test(lines[i].trim())) {
                    code += lines[i] + "\n"; i++;
                }
                i++; // skip closing fence
                html += "<pre class=\"ai-pre\"><code>" + code.replace(/\n$/, "") + "</code></pre>";
                continue;
            }

            // GFM table: this row has a pipe and the next line is a --- separator
            const next = (i + 1 < lines.length) ? lines[i + 1].trim() : "";
            if (t.indexOf("|") >= 0 && isTableSep(next)) {
                closeList();
                const header = splitRow(t);
                i += 2; // skip header + separator
                const rows = [];
                while (i < lines.length && lines[i].trim() !== "" && lines[i].indexOf("|") >= 0) {
                    rows.push(splitRow(lines[i].trim())); i++;
                }
                html += "<table class=\"ai-table\"><thead><tr>" +
                    header.map((h) => "<th>" + inline(h) + "</th>").join("") +
                    "</tr></thead><tbody>";
                rows.forEach((r) => {
                    html += "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>";
                });
                html += "</tbody></table>";
                continue;
            }

            // horizontal rule
            if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { closeList(); html += "<hr>"; i++; continue; }

            let m;
            // heading  # .. ######
            if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
                closeList();
                const lvl = Math.min(m[1].length + 2, 6); // #, ## -> h3, h4 ...
                html += "<h" + lvl + " class=\"ai-h\">" + inline(m[2]) + "</h" + lvl + ">";
            // blockquote (">" is already escaped to "&gt;" by escapeHtml)
            } else if ((m = t.match(/^&gt;\s?(.*)$/))) {
                closeList();
                html += "<blockquote class=\"ai-quote\">" + inline(m[1]) + "</blockquote>";
            // numbered list
            } else if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) {
                if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; }
                html += "<li>" + inline(m[2]) + "</li>";
            // bullet list
            } else if ((m = t.match(/^[-*•]\s+(.*)$/))) {
                if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; }
                html += "<li>" + inline(m[1]) + "</li>";
            // paragraph
            } else {
                closeList();
                html += "<p>" + inline(t) + "</p>";
            }
            i++;

        }

        closeList();
        return html;

    }

    // Report fields the assistant's answer can be dropped into.
    const INSERT_TARGETS = [
        { id: "prodSpecs", label: "Product Details" },
        { id: "objective", label: "Test Objective" },
        { id: "equipment", label: "Test Equipment" },
        { id: "procedure", label: "Test Procedure" },
        { id: "observation", label: "Observation" },
        { id: "resultText", label: "Test Result" },
        { id: "recommendation", label: "Recommendation" },
        { id: "conclusion", label: "Conclusion" }
    ];

    function insertIntoField(id, text) {

        const field = document.getElementById(id);
        if (!field) return;

        const t0 = INSERT_TARGETS.find((x) => x.id === id);
        const label = t0 ? t0.label : id;

        // A section removed from the report: inserting there would put text
        // where nobody (and no PDF) can see it.
        const card = field.closest(".section-card");
        if (card && card.style.display === "none") {
            addMessage("info", "The " + label + " section is removed from the report — press \"+ Add " + label + " section\" first, then insert again.");
            return;
        }

        // Never wipe what the user already wrote without asking.
        const html = formatMarkdown(text);
        if (field.innerText.trim()) {
            const replace = confirm(label + " already has text.\n\nOK = replace it with the AI answer\nCancel = add the AI answer below it");
            field.innerHTML = replace ? html : field.innerHTML + html;
        } else {
            // Keep the same formatting (line breaks / lists / bold) as the chat.
            field.innerHTML = html;
        }

        // Match the report's numbered-step styling when filling the procedure.
        if (id === "procedure") {
            field.querySelectorAll("ol").forEach((o) => o.classList.add("procedure-steps"));
        }

        // Dispatch "input" so the report auto-saves.
        field.dispatchEvent(new Event("input", { bubbles: true }));

        if (typeof checkPageFit === "function") checkPageFit();

        field.scrollIntoView({ behavior: "smooth", block: "center" });
        field.classList.add("ai-filled");
        setTimeout(() => field.classList.remove("ai-filled"), 1400);

        const t = INSERT_TARGETS.find((x) => x.id === id);
        addMessage("info", "Inserted into " + (t ? t.label : id) + ".");

    }

    function addMessage(role, text, allowInsert) {

        const el = document.createElement("div");

        el.className = "ai-msg " + role;

        // Bot answers render as formatted HTML (lists / bold / line breaks);
        // everything else stays plain text.
        if (role === "bot") {
            const content = document.createElement("div");
            content.className = "ai-content";
            content.innerHTML = formatMarkdown(text);
            el.appendChild(content);
        } else {
            el.textContent = text;
        }

        // Real assistant replies get an "Insert into <field>" picker + Copy.
        if (role === "bot" && allowInsert) {

            const bar = document.createElement("div");
            bar.className = "ai-insert-bar";

            const sel = document.createElement("select");
            sel.className = "ai-insert-sel";
            let opts = '<option value="">📋 Insert into…</option>';
            INSERT_TARGETS.forEach((tg) => {
                opts += '<option value="' + tg.id + '">' + tg.label + '</option>';
            });
            sel.innerHTML = opts;
            sel.addEventListener("change", () => {
                if (!sel.value) return;
                insertIntoField(sel.value, text);
                sel.value = "";
            });
            bar.appendChild(sel);

            const copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "ai-insert-copy";
            copyBtn.textContent = "Copy";
            copyBtn.addEventListener("click", () => {
                try { navigator.clipboard.writeText(text); } catch (e) { /* ignore */ }
                copyBtn.textContent = "Copied";
                setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
            });
            bar.appendChild(copyBtn);

            el.appendChild(bar);

        }

        messages.appendChild(el);

        messages.scrollTop = messages.scrollHeight;

        return el;

    }

    // ---------- sending ----------

    function autoGrow() {

        input.style.height = "auto";

        input.style.height = Math.min(input.scrollHeight, 120) + "px";

    }

    input.addEventListener("input", autoGrow);

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            sendMessage();

        }

    });

    sendBtn.addEventListener("click", sendMessage);

    // ---------- attachments (photo / file) ----------

    attachBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {

        const f = fileInput.files && fileInput.files[0];
        fileInput.value = "";               // let the same file be picked again
        if (!f) return;

        if (f.size > MAX_ATTACH) {
            addMessage("error", "That file is too big (max 5 MB).");
            return;
        }

        const reader = new FileReader();

        reader.onerror = () => addMessage("error", "Could not read that file.");

        if (f.type.indexOf("image/") === 0) {
            reader.onload = () => {
                pendingAttachment = { kind: "image", name: f.name, mime: f.type, dataUrl: reader.result };
                showAttachChip();
            };
            reader.readAsDataURL(f);
        } else if (TEXT_EXT.test(f.name) || (f.type && f.type.indexOf("text/") === 0)) {
            reader.onload = () => {
                // Decoded as UTF-8 or the Windows code page (Excel CSVs), and when a
                // long file is cut, the AI is told so instead of answering as if
                // the file ended there.
                const full = decodeTextFile(reader.result);
                const LIM = 20000;
                const text = full.length > LIM
                    ? full.slice(0, LIM) + "\n[… the file continues — only its first " + LIM + " characters are included]"
                    : full;
                pendingAttachment = { kind: "text", name: f.name, text: text };
                showAttachChip();
            };
            reader.readAsArrayBuffer(f);
        } else {
            pendingAttachment = { kind: "other", name: f.name };
            showAttachChip();
        }

    });

    function showAttachChip() {

        attachBar.innerHTML = "";

        const chip = document.createElement("div");
        chip.className = "ai-att-pending";

        if (pendingAttachment.kind === "image") {
            const img = document.createElement("img");
            img.src = pendingAttachment.dataUrl;
            img.className = "ai-att-thumb";
            chip.appendChild(img);
        }

        const name = document.createElement("span");
        name.className = "ai-att-name";
        name.textContent = (pendingAttachment.kind === "image" ? "" : "📎 ") + pendingAttachment.name +
            (pendingAttachment.kind === "other" ? " (contents can't be read)" : "");
        chip.appendChild(name);

        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "ai-att-remove";
        rm.textContent = "×";
        rm.title = "Remove";
        rm.addEventListener("click", clearAttachment);
        chip.appendChild(rm);

        attachBar.appendChild(chip);
        attachBar.hidden = false;

    }

    function clearAttachment() {
        pendingAttachment = null;
        attachBar.innerHTML = "";
        attachBar.hidden = true;
    }

    // ---------- image GENERATION (free, keyless - Pollinations) ----------
    // Detects "generate / give / show ... image / picture of X" and returns the
    // subject to draw, or null if the message is not an image request.
    const IMG_WORD = /\b(image|images|img|imgs|picture|pics?|photo|photos|diagram|drawing|illustration|sketch|render|logo|icon|wallpaper|artwork)\b/i;
    function imageGenRequest(text) {
        const t = String(text || "").trim();
        if (!t || !IMG_WORD.test(t)) return null;
        // A QUESTION about a picture is not a request to draw one. This veto used
        // to apply only when a file was attached, and the bare "of" below counted
        // as a request, so "explain the block diagram of a BMS" answered with a
        // generated picture of "a BMS" instead of an explanation - and, being a
        // generated turn, it was then kept out of the context for the follow-up.
        if (/\b(read|analyse|analyze|explain|describe|what|which|why|how|tell|identify|check|meaning|understand|compare|difference|define)\b/i.test(t)) return null;
        // Two ways to count as "draw me something":
        //   * the message STARTS with a make-verb ("draw a hub motor"), or
        //   * the image word is followed by of / for / showing / with
        //     ("show me a picture OF a hub motor").
        // "show the battery pack diagram" matches neither - it asks about an
        // existing diagram, so it is answered instead of being sent to the image
        // service (which also puts the words into a URL path).
        const startsWithMake = /^\s*(please\s+)?(generate|create|draw|make|render|design|produce|imagine)\b/i.test(t);
        const imageOfSomething = /\b(image|images|img|imgs|picture|pics?|photo|photos|diagram|drawing|illustration|sketch|render|logo|icon|wallpaper|artwork)\s+(of|for|showing|with)\b/i.test(t);
        if (!startsWithMake && !imageOfSomething) return null;
        let subj = t;
        const m = subj.match(/(?:image|images|img|imgs|picture|pics?|photo|photos|diagram|drawing|illustration|sketch|render|logo|icon|wallpaper|artwork)\s+(?:of|for|showing|with)\s+(.+)$/i);
        if (m) {
            subj = m[1];
        } else {
            subj = subj
                .replace(/\b(please|can you|could you|kindly|i\s+(need|want|would like)|give|show|get|need|want|generate|create|make|draw|display|design|render|produce|provide|imagine)\b/gi, " ")
                .replace(/\b(an?|the|some|me|to|for|of)\b/gi, " ")
                .replace(IMG_WORD, " ")
                .replace(/\s+/g, " ").trim();
        }
        subj = subj.replace(/[?.!,:;]+$/, "").trim();
        return subj || null;
    }

    // The seed decides WHICH picture comes back. Passing the saved one redraws
    // the same image; only a brand-new request picks a fresh seed. Without this
    // every reload re-requested the turn and showed a DIFFERENT picture (and
    // "Open full size" pointed at that new one).
    function pollImageUrl(prompt, seed) {
        const p = encodeURIComponent(String(prompt).slice(0, 300));
        const s = (seed == null ? Math.floor(Math.random() * 1e9) : seed);
        return "https://image.pollinations.ai/prompt/" + p +
            "?width=768&height=768&nologo=true&seed=" + s;
    }

    // The conversation as sent to the AI: text turns only. Generated-image turns
    // are kept for the screen and the download, never as context.
    function aiContext() {
        const turns = history.filter((m) => !m.genTurn);
        // Only the NEWEST turn that carried a file keeps the file's contents.
        // Older ones are sent as what the user actually typed: a 20,000-character
        // log used to ride along with each of the next twelve messages, which
        // made every later reply slow and pushed the free models into 413 / 429.
        let lastWithFile = -1;
        turns.forEach((m, i) => { if (m.bare != null) lastWithFile = i; });
        return turns.map((m, i) => ({
            role: m.role,
            content: (m.bare != null && i !== lastWithFile) ? m.bare : m.content
        }));
    }

    function addImageMessage(subject, seed) {
        const url = pollImageUrl(subject, seed);
        const el = document.createElement("div");
        el.className = "ai-msg bot";
        const cap = document.createElement("div");
        cap.className = "ai-content";
        cap.innerHTML = "🎨 Generated image of <b>" + escapeHtml(subject) + "</b>:";
        el.appendChild(cap);
        const wrap = document.createElement("div");
        wrap.className = "ai-genimg-wrap";
        const loading = document.createElement("div");
        loading.className = "ai-genimg-loading";
        loading.innerHTML = "<span class='spin'></span> Generating image…";
        const img = document.createElement("img");
        img.className = "ai-genimg";
        img.alt = subject;
        img.style.display = "none";
        img.onload = () => { loading.style.display = "none"; img.style.display = "block"; };
        img.onerror = () => { loading.textContent = "⚠️ Image service is busy — please try again in a moment."; };
        img.src = url;
        wrap.appendChild(loading);
        wrap.appendChild(img);
        el.appendChild(wrap);
        const dl = document.createElement("a");
        dl.href = url; dl.target = "_blank"; dl.rel = "noopener";
        dl.className = "ai-genimg-dl";
        dl.textContent = "⬇ Open full size";
        el.appendChild(dl);
        messages.appendChild(el);
        messages.scrollTop = messages.scrollHeight;
    }

    async function sendMessage() {

        if (busy) return;

        const text = input.value.trim();
        const att = pendingAttachment;

        if (!text && !att) return;

        if (!navigator.onLine) {

            // The built-in library (a specific test, "test cases for …", a report
            // section) needs no connection - answer from it even offline. This
            // check used to run first, so offline "IPX7" got an error instead.
            const offlineAnswer = att ? null : localFallbackAnswer(text, true);

            if (!offlineAnswer) {
                addMessage("error",
                    "You are offline. The AI assistant needs an internet " +
                    "connection. The rest of the report still works offline.");
                return;
            }

            addMessage("user", text);
            history.push({ role: "user", content: text });
            addMessage("bot", offlineAnswer, true);
            history.push({ role: "assistant", content: offlineAnswer });
            saveHistory();
            input.value = "";
            autoGrow();
            return;

        }

        // Text that goes into the conversation (and gets re-sent as context).
        // For images we keep the history text-only and attach the picture just
        // to this one request, so old images don't bloat every later call.
        let content = text;
        if (att && att.kind === "text") {
            content = (text ? text + "\n\n" : "") + "[Attached file: " + att.name + "]\n" + att.text;
        } else if (att && att.kind === "image") {
            content = text || "(see the attached image)";
        } else if (att && att.kind === "other") {
            content = (text ? text + "\n\n" : "") + "[Attached file: " + att.name + " - contents could not be read]";
        }

        // Show the user's message, with a thumbnail / chip for the attachment.
        const userEl = addMessage("user", text || (att ? att.name : ""));
        if (att) {
            const disp = document.createElement("div");
            disp.className = "ai-att-chip";
            if (att.kind === "image") {
                const img = document.createElement("img");
                img.src = att.dataUrl;
                img.className = "ai-att-thumb";
                disp.appendChild(img);
            } else {
                disp.textContent = "📎 " + att.name;
            }
            userEl.appendChild(disp);
        }

        // display: what the user's bubble shows - not the whole attached file.
        history.push({
            role: "user", content: content,
            // display: what the user's bubble shows - not the whole attached file.
            display: text || (att ? "📎 " + att.name : ""),
            // bare: the same turn WITHOUT the file's contents, used by aiContext()
            // for every later message so the file is not re-sent each time.
            bare: (att && att.kind === "text") ? (text || "(see the attached file)") : undefined
        });

        currentAttachment = att;   // rides only this request
        clearAttachment();

        input.value = "";

        autoGrow();

        busy = true;

        sendBtn.disabled = true;

        const typing = addMessage("ai-typing", "Assistant is typing...");

        try {

            // Image-generation request ("give the motor image") -> draw & show it.
            const imgSubj = att ? null : imageGenRequest(text);
            if (imgSubj) {
                typing.remove();
                // The seed is saved with the turn so a reload redraws THIS picture.
                const imgSeed = Math.floor(Math.random() * 1e9);
                addImageMessage(imgSubj, imgSeed);
                // Keep the image in the saved chat (it used to vanish on reload),
                // but mark the turn so it stays OUT of the text AI context -
                // otherwise the model copies the pattern and replies with text.
                history[history.length - 1].genTurn = true;
                history.push({ role: "assistant", content: "", genImage: imgSubj, genSeed: imgSeed, genTurn: true });
                saveHistory();
                return;   // the `finally` block still resets the busy state
            }

            let reply;

            // For questions the VERIFIED built-in library fully covers (a specific
            // test, "test cases for <product>", a report section), answer from it
            // directly - it is audited-correct, so this is more accurate than any
            // model. Skip when an image is attached (that needs AI vision).
            const builtin = att ? null : localFallbackAnswer(text, true);
            if (builtin) {
                reply = builtin;
            } else {
                // Otherwise route to the chosen provider (automatic by default).
                // NOTE: "gemini" must NOT be gated on haveKey() - that checks the
                // OpenAI key box, so picking "Always Google Gemini" used to fall
                // through to the free path and never call Gemini at all.
                const provider = localStorage.getItem("aiProvider") || "free";
                if (provider === "gemini") {
                    // Preferred, but never leave the user with canned offline text
                    // just because one service is briefly rate-limited.
                    try { reply = await callGemini(); }
                    catch (e) { reply = await callFreeAI(true); }
                } else if (provider === "openrouter") {
                    // If Gemini is busy too, carry on down the shared free chain
                    // (Puter, Pollinations) rather than dropping the user straight
                    // to canned offline text while two backends were never tried.
                    try { reply = await callOpenRouterOnly(); }
                    catch (e) {
                        try { reply = await callGemini(); }
                        catch (e2) { reply = await callFreeAI(true); }
                    }
                } else if (provider === "openai" && haveKey()) reply = await callOpenAI();
                else {
                    // "OpenAI" chosen but no key saved: the answer comes from the
                    // shared free services, NOT from the user's paid account.
                    // Say so once, rather than letting them believe otherwise.
                    if (provider === "openai" && !haveKey() && !messages.dataset.noKeyTold) {
                        messages.dataset.noKeyTold = "1";
                        addMessage("info", "No OpenAI key is saved, so this answer came from the free assistant — add your key in ⚙️ settings to use your own account.");
                    }
                    reply = await callFreeAI();
                }
            }

            typing.remove();

            addMessage("bot", reply, true);

            history.push({ role: "assistant", content: reply });

            saveHistory();

        } catch (err) {

            typing.remove();

            // Never leave a message unanswered: when the online AI is busy or
            // unreachable, reply from the built-in offline knowledge instead.
            const reply = localFallbackAnswer(text);
            addMessage("bot", reply, true);
            history.push({ role: "assistant", content: reply });

            saveHistory();

            // Keep the file attached, so it can be sent again without picking it again.
            if (att && !pendingAttachment) {
                pendingAttachment = att;
                showAttachChip();
                addMessage("info", "Your file is still attached — press send to try again in a moment.");
            }

        } finally {

            currentAttachment = null;

            busy = false;

            sendBtn.disabled = false;

            input.focus();

        }

    }

    // Builds OpenAI-style messages, turning the last user turn into a vision
    // message when an image is attached (used by the free backend and OpenAI).
    function buildOpenAIMessages() {

        const msgs = [{ role: "system", content: SYSTEM_PROMPT }].concat(aiContext().slice(-12));

        if (currentAttachment && currentAttachment.kind === "image") {
            for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === "user") {
                    const txt = typeof msgs[i].content === "string" ? msgs[i].content : "";
                    msgs[i] = {
                        role: "user",
                        content: [
                            { type: "text", text: txt },
                            { type: "image_url", image_url: { url: currentAttachment.dataUrl } }
                        ]
                    };
                    break;
                }
            }
        }

        return msgs;

    }

    // Answers a question from the app's VERIFIED built-in knowledge (test
    // standards/procedures, "test cases for <product>", report-section help).
    // With confidentOnly=true it returns a reply ONLY when it is sure the
    // built-in data fully answers the question (used to answer such questions
    // correctly even when the online AI is up); otherwise it returns null so
    // the question goes to the AI. With confidentOnly=false it also handles
    // greetings and always returns a helpful message (the offline safety net).
    function localFallbackAnswer(question, confidentOnly) {
        const q = String(question || "").trim();
        const lc = q.toLowerCase();

        // 1) Greeting (not a "confident" built-in fact - let the AI take it).
        if (!confidentOnly && /^(hi+|hey+|hello|hai|yo|vanakkam|namaste|good\s*(morning|afternoon|evening))\b/.test(lc)) {
            return "Hello! 👋 I can help with your EV test report. Ask me about a **test's " +
                "standard and procedure** (e.g. \"IP67 test\", \"vibration test\", \"overcharge test\"), " +
                "or how to fill a section like **Objective, Equipment, Procedure, Observation, " +
                "Result, Recommendation** or **Conclusion**.";
        }

        // 2) "Test cases for <product>" -> the built-in curated list with standards.
        if (/test\s*case|tests?\s+(for|of)\b|list\s+(the\s+)?tests?/.test(lc) && typeof window.evTestCasesFor === "function") {
            let m = q.match(/(?:test\s*cases?|tests?)\s*(?:for|of|:)\s*(.+)$/i)
                 || q.match(/(?:for|of)\s+(.+?)(?:\s+test\s*cases?|\s+tests?)?$/i)
                 || q.match(/^(.+?)\s+test\s*cases?/i);
            let product = m ? m[1].trim().replace(/[?.!]+$/, "") : "";
            product = product.replace(/^(the|a|an|please|give|show|list|me)\s+/i, "").trim();
            if (product) {
                let cases = [];
                try { cases = window.evTestCasesFor(product) || []; } catch (e) { cases = []; }
                if (cases.length) {
                    let md = "_(offline answer)_ **Standard test cases for " + product + "** (" + cases.length + "):\n\n";
                    md += cases.map((t, i) => {
                        const tp = (typeof pickProcedure === "function") ? pickProcedure(t) : null;
                        const std = (tp && tp.standard && tp.standard !== GENERIC_PROCEDURE.standard) ? tp.standard : "";
                        return (i + 1) + ". **" + t + "**" + (std ? " — " + std : "");
                    }).join("\n");
                    md += "\n\nAsk about any one (e.g. \"" + cases[0] + "\") for its full procedure.";
                    return md;
                }
            }
        }

        // 3) A known test -> its real standard + procedure from the built-in library.
        // In confidentOnly mode only treat SHORT queries (basically just a test
        // name) as answered here, so longer questions still go to the AI.
        const shortQ = lc.split(/\s+/).filter(Boolean).length <= 6;
        if (q && (!confidentOnly || shortQ) && typeof pickProcedure === "function" && typeof GENERIC_PROCEDURE !== "undefined") {
            const tp = pickProcedure(q);
            if (tp && tp.standard && tp.standard !== GENERIC_PROCEDURE.standard) {
                const steps = (tp.procedure && tp.procedure[0]) ? tp.procedure[0] : [];
                let md = confidentOnly
                    ? "**Standard:** " + tp.standard + "\n\n"
                    : "_The online assistant is busy, so here is the built-in standard answer:_\n\n**Standard:** " + tp.standard + "\n\n";
                if (steps.length) {
                    md += "**Procedure**\n";
                    md += steps.map((s, i) => (i + 1) + ". " + s.replace(/\{n\}/g, "sample")).join("\n");
                }
                return md;
            }
        }

        // 4) Help with a specific report section.
        const sections = [
            { k: /\bobjective\b|purpose of the test/, t: "**Test Objective** — state what the test verifies and why (the requirement/standard it checks). Keep it to 1-2 lines. Tip: the **Auto** button drafts it for you." },
            { k: /\bequipment\b|\bsetup\b|apparatus|instrument/, t: "**Test Equipment & Setup** — list the instruments, fixtures and sample condition used, with ranges/calibration where relevant (e.g. chamber, shaker, power supply, DMM)." },
            { k: /\bprocedure\b|\bsteps?\b|method/, t: "**Test Procedure** — short, condition-based steps: the applied condition, its level, and the duration/cycles (e.g. \"8 h per axis\", \"100 cycles\"). Tip: the **Auto** button writes standard steps for the chosen test." },
            { k: /observation|\bresult of/, t: "**Observation** — write what you actually saw/measured during and after the test. Tip: the **Correct English** button uses the online AI to turn English, Tanglish or rough notes into correct, simple English points (and keeps every value you typed)." },
            { k: /\bresult\b|pass.?fail|pass or fail/, t: "**Test Result** — the verdict: **PASS** if every acceptance criterion is met, **FAIL** if any criterion, rating or safety limit is not met." },
            { k: /recommendation/, t: "**Recommendation** — what to do next based on the result (accept, rework, re-test, design change, or corrective action)." },
            { k: /conclusion/, t: "**Conclusion** — a short closing summary of whether the sample met the requirement. Tip: the **Auto** button drafts it." }
        ];
        for (let i = 0; i < sections.length; i++) {
            if (sections[i].k.test(lc)) return sections[i].t;
        }

        // 5) Nothing the built-in library confidently covers.
        if (confidentOnly) return null;   // -> send the question to the AI
        return "⚠️ The free online assistant is busy right now, so I could not fetch a full answer.\n\n" +
            "I can still help **offline** with:\n" +
            "- **Test standards & procedures** — e.g. \"IP67 test\", \"vibration test\", \"salt spray test\"\n" +
            "- **Filling a report section** — e.g. \"how to write the objective\", \"what goes in equipment\"\n\n" +
            "For anything else, please wait a few moments and send your message again (the free service clears up soon).";
    }

    // Free, keyless backends. Tries Puter.js first (free AI with no API key -
    // a one-time "Continue as guest" popup may appear on first use), then the
    // Pollinations community service. Do not send confidential data through
    // either. If both fail, the caller answers from the offline knowledge.
    // "Always OpenRouter" - that service only, no Gemini.
    async function callOpenRouterOnly() {
        const v = await openRouterChat(buildOpenAIMessages());
        if (v) return v;
        throw new Error("OpenRouter did not answer");
    }

    // skipGemini: Gemini was already tried for this message (provider "Always
    // Google Gemini" and it failed) - don't wait on it a second time.
    async function callFreeAI(skipGemini) {

        // Full messages - the last user turn includes the attached image (if any).
        const rawMsgs = buildOpenAIMessages();
        const hasImg = !!(currentAttachment && currentAttachment.kind === "image");

        // With a photo, Gemini goes FIRST - it is the only free backend that reads
        // images properly. Gemini was missing from this chain entirely, so when
        // OpenRouter was busy the chat dropped straight to canned offline text.
        if (hasImg && !skipGemini) {
            try { const g = await callGemini(); if (g) return g; } catch (e) { /* try the rest */ }
        }

        // ---- 1) OpenRouter (built-in free key; also ANALYSES an attached image) ----
        const orv = await openRouterChat(rawMsgs);
        if (orv) return orv;

        // ---- 1b) Gemini for text, once OpenRouter has had its turn ----
        if (!hasImg && !skipGemini) {
            try { const g = await callGemini(); if (g) return g; } catch (e) { /* fall through */ }
        }

        // Text-only view for the remaining backends (they skip images).
        const pmsgs = rawMsgs.map((m) => ({
            role: m.role,
            content: typeof m.content === "string"
                ? m.content
                : (Array.isArray(m.content) ? m.content.map((p) => p.text || "").join("\n").trim() : String(m.content || ""))
        }));

        // ---- 2) Puter.js (keyless) ----
        // Use it silently when signed in. When not signed in, allow its sign-in
        // window ONCE per session so it never nags (sign-in is also in settings).
        let allowPopup = false;
        try {
            const signedIn = !!(window.puter && window.puter.auth && window.puter.auth.isSignedIn && window.puter.auth.isSignedIn());
            if (!signedIn) { allowPopup = !callFreeAI._puterAsked; callFreeAI._puterAsked = true; }
        } catch (e) { /* ignore */ }
        const pv = await puterChat(pmsgs, allowPopup);
        if (pv) return pv;

        // ---- 3) Pollinations (original free backend) ----
        const res = await fetch("https://text.pollinations.ai/", {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({

                model: "openai",

                messages: pmsgs

            }),

            signal: aiSignal(45000)

        });

        if (!res.ok) {

            throw new Error(
                "the free assistant is busy (" + res.status +
                "). Please try again in a moment.");

        }

        // This endpoint returns plain text, not JSON.
        const reply = (await res.text()).trim();

        return reply || "The assistant returned an empty reply.";

    }

    // Google Gemini - free with a Google account (no payment). Uses the user's
    // own AI Studio key. Different request shape from OpenAI: system prompt goes
    // in "system_instruction" and roles are "user"/"model".
    async function callGemini() {

        // The user's own Gemini key if set, else the built-in one. Never the OpenAI
        // key ("aiKey"): that would send the OpenAI key to Google, which rejects it.
        const key = (localStorage.getItem("aiGeminiKey") || "").trim() || GEMINI_KEY;

        // GEMINI_MODEL, not "gemini-2.0-flash": that model now answers
        // 404 "no longer available", which broke every chat reply.
        const model = ((localStorage.getItem("aiGeminiModel") || "").trim() || GEMINI_MODEL);

        const contents = aiContext().slice(-12).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
        }));

        // Attach the image to the last (current) user turn.
        if (currentAttachment && currentAttachment.kind === "image" && contents.length) {
            contents[contents.length - 1].parts.push({
                inlineData: {
                    mimeType: currentAttachment.mime,
                    data: currentAttachment.dataUrl.split(",")[1]
                }
            });
        }

        // Key in a header, not the URL - see the note in geminiChat(). With no key
        // in the browser, the hosted site's /api/ai function adds it.
        const res = await geminiFetch(model, key, {
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: contents
            }, aiSignal(45000));

        if (!res) throw new Error("Gemini error: no Gemini key is set - add one in Ask AI settings");

        if (!res.ok) {

            let detail = res.status;
            try { const e = await res.json(); if (e.error && e.error.message) detail = e.error.message; } catch (x) { /* keep status */ }
            throw new Error("Gemini error: " + detail);

        }

        const data = await res.json();

        const cand = (data.candidates || [])[0] || {};
        const parts = ((cand.content || {}).parts) || [];
        const reply = parts.map((p) => p.text || "").join("").trim();

        return reply || "The assistant returned an empty reply.";

    }

    async function callOpenAI() {

        const key = (localStorage.getItem("aiKey") || "").trim();

        const model = (localStorage.getItem("aiModel") || DEFAULT_MODEL).trim();

        const res = await fetch("https://api.openai.com/v1/chat/completions", {

            method: "POST",

            headers: {

                "Content-Type": "application/json",

                "Authorization": "Bearer " + key

            },

            body: JSON.stringify({

                model: model,

                messages: buildOpenAIMessages(),

                temperature: 0.3

            }),

            signal: aiSignal(60000)

        });

        if (!res.ok) {

            let detail = res.status + " " + res.statusText;

            try {

                const body = await res.json();

                if (body.error && body.error.message) detail = body.error.message;

            } catch (e) { /* keep the status line */ }

            throw new Error(detail);

        }

        const data = await res.json();

        const choice = data.choices && data.choices[0];

        return (choice && choice.message && choice.message.content
            ? choice.message.content.trim()
            : "The model returned an empty reply.");

    }

    // ---------- download chat ----------

    // Builds a plain-text transcript of the whole conversation.
    function buildTranscript() {

        const lines = [

            "BNC Motors - Product Validation Test Report",
            "AI Assistant chat",
            "Downloaded: " + new Date().toLocaleString(),
            "----------------------------------------",
            ""

        ];

        history.forEach((m) => {

            lines.push(m.role === "user" ? "You:" : "Assistant:");

            lines.push(m.genImage ? "[Generated image: " + m.genImage + "]" : m.content);

            lines.push("");

        });

        return lines.join("\r\n");

    }

    async function downloadChat() {

        if (!history.length) {

            alert("There is no chat to download yet.");

            return;

        }

        const blob = new Blob([buildTranscript()], {

            type: "text/plain;charset=utf-8"

        });

        const filename = "AI Chat.txt";

        try {

            // Chrome / Edge: let the user pick the folder, like the PDF export.
            if (window.showSaveFilePicker) {

                const handle = await window.showSaveFilePicker({

                    suggestedName: filename,

                    types: [{
                        description: "Text file",
                        accept: { "text/plain": [".txt"] }
                    }]

                });

                const writable = await handle.createWritable();

                await writable.write(blob);

                await writable.close();

            } else {

                // Firefox / Safari: normal download to the default folder.
                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");

                a.href = url;

                a.download = filename;

                document.body.appendChild(a);

                a.click();

                a.remove();

                URL.revokeObjectURL(url);

            }

        } catch (err) {

            if (err && err.name !== "AbortError") {

                alert("Could not download the chat: " + err.message);

            }

        }

    }

    downloadBtn.addEventListener("click", downloadChat);

    // ---------- clear chat ----------

    clearBtn.addEventListener("click", () => {

        history.length = 0;

        localStorage.removeItem(HISTORY_KEY);

        messages.innerHTML = "";

        delete messages.dataset.greeted;

        addMessage("info", "Chat cleared.");

    });

    // ---------- restore the saved chat on load ----------

    (function restoreHistory() {

        let saved;

        try {

            saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

        } catch (e) {

            saved = [];

        }

        if (Array.isArray(saved) && saved.length) {

            saved.forEach((m) => {

                history.push(m);

                // A generated image comes back as the image; bot replies get
                // their "Insert into…" bar back after a reload.
                if (m.genImage) addImageMessage(m.genImage, m.genSeed);
                else if (m.role === "user") addMessage("user", m.display != null ? m.display : m.content, false);
                else addMessage("bot", m.content, true);

            });

            // Skip the first-open greeting when a conversation already exists.
            messages.dataset.greeted = "1";

        }

    })();

})();

// ===========================================
// LIGHT / DARK GLASS THEME TOGGLE
// A small floating button that switches the app-shell between the light
// and dark glass themes. Only the chrome changes - the printed report and
// the exported PDF always stay light/formal. The choice is remembered.
// ===========================================
(function () {

    const KEY = "uiTheme";
    const root = document.documentElement;

    function apply(theme) {
        if (theme === "dark") root.setAttribute("data-theme", "dark");
        else root.removeAttribute("data-theme");
    }

    let theme = "light";
    try { theme = localStorage.getItem(KEY) || "light"; } catch (e) { /* ignore */ }
    apply(theme);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.title = "Switch light / dark theme";

    function label() {
        btn.innerHTML = theme === "dark" ? "☀️ Light" : "🌙 Dark";
    }
    label();

    btn.addEventListener("click", () => {
        theme = (theme === "dark") ? "light" : "dark";
        apply(theme);
        label();
        try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
    });

    document.body.appendChild(btn);

})();

// ===========================================
// RCA REPORT
//
// Generates a full Root Cause Analysis online (8D / 5-Why / Fishbone) from a
// short failure description. The standard RCA METHOD is built in, so the
// procedure for creating an RCA is always available even offline, and it is
// also used as the skeleton the AI fills in.
// ===========================================
(function () {

    const genBtn = document.getElementById("rcaGenerate");
    if (!genBtn) return;

    const methodBtn = document.getElementById("rcaMethod");
    const dlBtn = document.getElementById("rcaDownload");
    const clearBtn = document.getElementById("rcaClear");
    const statusEl = document.getElementById("rcaStatus");
    const methodBox = document.getElementById("rcaMethodBox");
    const reportBox = document.getElementById("rcaReport");
    const fields = {
        no: document.getElementById("rcaNo"),
        rev: document.getElementById("rcaRev"),
        issue: document.getElementById("rcaIssue"),
        status: document.getElementById("rcaStatus2"),
        product: document.getElementById("rcaProduct"),
        partNo: document.getElementById("rcaPartNo"),
        // Company data the AI must never invent - collected up front so the report
        // does not come out with these boxes empty.
        model: document.getElementById("rcaModel"),
        flash: document.getElementById("rcaFlash"),
        date: document.getElementById("rcaDate"),
        qty: document.getElementById("rcaQty"),
        where: document.getElementById("rcaWhere"),
        by: document.getElementById("rcaBy"),
        approver: document.getElementById("rcaApprover"),
        verifier: document.getElementById("rcaVerifier"),
        cust: document.getElementById("rcaCust"),
        team: document.getElementById("rcaTeam"),
        problem: document.getElementById("rcaProblem")
    };
    const photosBox = document.getElementById("rcaPhotos");
    let photos = [];   // data URLs of the evidence photos

    const esc = (s) => String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    function setStatus(msg, kind) {
        statusEl.textContent = msg || "";
        statusEl.className = "cases-status" + (kind ? " " + kind : "");
    }

    // Hand a generated file to the browser.
    //
    // A straight programmatic a.click() is only reliably allowed while the browser
    // still considers the page to be acting on the user's click. The PDF takes
    // several seconds to rasterise, so by the time it is ready that window has
    // closed and the save is silently dropped - nothing downloads, no error. On top
    // of that, browsers block a page from auto-saving more than one file, which is
    // why the PDF failed specifically when exported after the Word file.
    //
    // So: still attempt the automatic save, but ALWAYS leave a real link the user
    // can click. Their click is a fresh, genuine gesture, which is always allowed.
    // Ask the user where to save BEFORE any slow work, while the browser still
    // treats this as their click. Writing through the returned handle is a direct
    // file write, NOT a "download", so it is completely unaffected by the browser
    // blocking a page from saving more than one file automatically - which is what
    // made the SECOND export (whichever format it was) silently fail.
    // Returns: a handle, "cancel" if the user dismissed the dialog, or null if the
    // browser has no File System Access API (then we fall back to offerFile).
    async function pickSave(suggestedName, mime, ext) {
        if (!window.showSaveFilePicker) return null;
        const accept = {}; accept[mime] = [ext];
        try {
            return await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{ description: ext.replace(".", "").toUpperCase() + " file", accept: accept }]
            });
        } catch (e) {
            if (e && e.name === "AbortError") return "cancel";
            return null;   // not supported / blocked -> use the download fallback
        }
    }

    // Save through a picked handle, else fall back to the link-based delivery.
    async function deliverFile(handle, blob, filename, label, openable) {
        if (handle && handle !== "cancel") {
            const ws = await handle.createWritable();
            await ws.write(blob);
            await ws.close();
            setStatus(label + " saved (" + Math.round(blob.size / 1024) + " KB) to " + (handle.name || filename) + ".", "ok");
            return;
        }
        offerFile(blob, filename, label, openable);
    }

    function offerFile(blob, filename, label, openable) {
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement("a");
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (e) { /* fall through to the manual links below */ }
        setStatus(label + " ready (" + Math.round(blob.size / 1024) + " KB). If it did not save automatically:", "ok");
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.className = "rca-savelink";
        link.textContent = "💾 Save " + filename;
        statusEl.appendChild(document.createTextNode(" "));
        statusEl.appendChild(link);
        // If the browser is blocking downloads for this site outright, even a clicked
        // save link is refused. Opening the file in a tab is NOT a download, so it is
        // never blocked - the built-in viewer then has its own save button.
        if (openable) {
            const view = document.createElement("a");
            view.href = url;
            view.target = "_blank";
            view.rel = "noopener";
            view.className = "rca-savelink rca-openlink";
            view.textContent = "🔎 Open in a new tab";
            statusEl.appendChild(document.createTextNode(" "));
            statusEl.appendChild(view);
        }
        // Keep the URL alive long enough for the user to click it.
        setTimeout(() => URL.revokeObjectURL(url), 600000);
    }

    // ---------- the standard RCA procedure (how to create an RCA report) ----------
    const RCA_METHOD = [
        { step: "1. Form the team & define the problem (8D D1-D2)",
          detail: "Bring together the people who know the process (production, quality, design, supplier). Write the problem as a fact, not an opinion, using IS / IS-NOT: WHAT failed, WHERE it was found, WHEN it started, HOW MANY units, WHO detected it and HOW it shows. Quantify it - never write 'motor is bad', write 'motor stops after 10 min, 12 of 500 units of lot A23, found at end-of-line test'." },
        { step: "2. Take containment action (8D D3)",
          detail: "Protect the customer FIRST, before you know the cause. Quarantine suspect stock in the plant, in transit and at the customer; 100% inspect or rework; mark the boundary lot numbers and dates. Record the containment date and who verified it. Containment is temporary - it is not the corrective action." },
        { step: "3. Collect the evidence / go to the Gemba",
          detail: "Gather the physical facts before they are lost: the failed parts, test data, process parameters, batch/traveller records, operator statements, photographs and any change history (4M change - Man, Machine, Material, Method). Go and look at the actual place and actual part; do not analyse from the desk." },
        { step: "4. Analyse the failed part (technical analysis)",
          detail: "Do the physical failure analysis - visual and dimensional check, strip-down, electrical measurement, microscopy / cross-section, hardness or material check as applicable. Compare the failed part with a good part. This tells you the FAILURE MODE (what physically happened), which is not yet the root cause." },
        { step: "5. Find the possible causes - Fishbone (Ishikawa 6M)",
          detail: "Brainstorm every possible cause under the 6M headings: Man, Machine, Material, Method, Measurement and Environment (Mother Nature). List them all without judging. Then use the evidence from steps 3-4 to mark each as Confirmed, Ruled-out, or Needs-check, so only fact-supported causes survive." },
        { step: "6. Drill to the root cause - 5-Why (three legs)",
          detail: "Take each surviving cause and ask 'Why?' until the answer reaches a system you can change (usually 4 to 6 whys). Do THREE separate 5-Why legs: (a) Occurrence - why was it made/why did it fail; (b) Detection - why did our checks not catch it; (c) Systemic - why did our system allow it (FMEA/control plan/standard missing). Each 'why' must be provable by evidence, and reversing the root cause must remove the effect." },
        { step: "7. Verify the root cause",
          detail: "Prove it by turn-on / turn-off: recreate the failure by re-introducing the cause, and make it disappear by removing the cause. If you cannot reproduce it, the root cause is still a theory - go back to step 5." },
        { step: "8. Define & implement corrective action (8D D5-D6)",
          detail: "Define a permanent corrective action for EACH root cause leg (occurrence, detection, systemic). Prefer error-proofing (poka-yoke) or design change over inspection and training, which are the weakest actions. Assign an owner and a due date to each, implement, and remove the containment only after the action is in place." },
        { step: "9. Verify effectiveness",
          detail: "Confirm with data that the action worked - the defect rate at the same operation over a defined period or quantity (for example 0 defects in the next 3 lots / 30 days). If it did not work, reopen the analysis. Record the evidence." },
        { step: "10. Prevent recurrence & close (8D D7-D8)",
          detail: "Update the PFMEA, control plan, drawing, work instruction and checklist. Apply the fix to all similar parts, lines and plants (horizontal deployment / yokoten). Capture the lesson learned, then close the report with the team's and approver's sign-off." }
    ];

    function methodHtml() {
        return '<div class="rca-sec-head"><b>📋 Standard procedure for creating an RCA report</b>' +
            '<span>8D / 5-Why / Fishbone method</span></div>' +
            '<ol class="rca-method-list">' +
            RCA_METHOD.map((m) => "<li><b>" + esc(m.step) + "</b><div>" + esc(m.detail) + "</div></li>").join("") +
            "</ol>";
    }

    methodBtn.addEventListener("click", () => {
        if (!methodBox.hidden) { methodBox.hidden = true; methodBtn.textContent = "📋 Show RCA procedure"; return; }
        methodBox.innerHTML = methodHtml();
        methodBox.hidden = false;
        methodBtn.textContent = "📋 Hide RCA procedure";
        methodBox.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // ---------- the report skeleton (also the offline fallback) ----------
    // key, title, 8D discipline
    const SECTIONS = [
        ["problem", "1. Problem Description", "D2"],
        ["containment", "2. Containment / Immediate Action", "D3"],
        ["evidence", "3. Evidence & Investigation", "D4"],
        ["analysis", "4. Failure Analysis (failure mode)", "D4"],
        ["fishbone", "5. Possible Causes — Fishbone (6M)", "D4"],
        ["why", "6. Root Cause Analysis — 5-Why", "D4"],
        ["rootcause", "7. Root Cause (occurrence / detection / systemic)", "D4"],
        ["corrective", "8. Corrective Action", "D5/D6"],
        ["preventive", "9. Preventive Action & Horizontal Deployment", "D7"],
        ["verification", "10. Verification of Effectiveness", "D6"],
        ["conclusion", "11. Conclusion", "D8"]
    ];

    // The 8D (Eight Disciplines) method - shown as a reference in the report so
    // any reader understands what each D-stage means and why it is done.
    const EIGHT_D = [
        ["D1", "Team", "Form a small cross-functional team that owns the problem."],
        ["D2", "Problem description", "Define the problem with facts (what / where / when / extent), incl. IS / IS-NOT."],
        ["D3", "Containment", "Immediate interim action so no more defective parts reach the line or customer."],
        ["D4", "Root cause analysis", "Find the true root cause using Fishbone (6M) and 5-Why, backed by evidence."],
        ["D5", "Corrective action", "Choose the permanent corrective action that removes the root cause."],
        ["D6", "Implement & verify", "Implement the fix and prove, with data, that it actually works."],
        ["D7", "Preventive action", "Prevent recurrence and deploy the fix to similar products / lines (horizontal deployment)."],
        ["D8", "Close & recognize", "Confirm the problem is closed, document it, and recognize the team."]
    ];
    function eightDHtml() {
        return '<table class="rca-8d-table">' +
            "<tr><th>Stage</th><th>Discipline</th><th>What it means &amp; why it is done</th></tr>" +
            EIGHT_D.map((r) => "<tr><td class='rca-8d-c'>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td><td>" + esc(r[2]) + "</td></tr>").join("") +
            "</table><div class='rca-8d-note'>The 8D method turns \"we fixed one bad part\" into \"we found why it failed, " +
            "proved it is fixed, and made sure it cannot happen again\" - with a documented, auditable trail.</div>";
    }

    // Formal title block of the document (always shows every field, like a real form).
    function headerHtml() {
        const v = (x) => (x && x.trim()) ? esc(x.trim()) : "&nbsp;";
        const st = fields.status.value || "Open";
        const cls = /closed/i.test(st) ? "st-closed" : (/implemented/i.test(st) ? "st-done" : "st-open");
        return '<table class="rca-head-table">' +
            "<tr><th>RCA / 8D No.</th><td>" + v(fields.no.value) + "</td>" +
                "<th>Revision</th><td>" + v(fields.rev.value) + "</td>" +
                "<th>Status</th><td><span class='rca-badge " + cls + "'>" + esc(st) + "</span></td></tr>" +
            "<tr><th>Product / Part</th><td>" + v(fields.product.value) + "</td>" +
                "<th>Part / Drawing No.</th><td>" + v(fields.partNo.value) + "</td>" +
                "<th>Issue date</th><td>" + v(fields.issue.value) + "</td></tr>" +
            "<tr><th>Date of occurrence</th><td>" + v(fields.date.value) + "</td>" +
                "<th>Qty affected / Lot</th><td>" + v(fields.qty.value) + "</td>" +
                "<th>Customer / Line</th><td>" + v(fields.cust.value) + "</td></tr>" +
            "<tr><th>Detected at</th><td>" + v(fields.where.value) + "</td>" +
                "<th>Prepared by</th><td>" + v(fields.by.value) + "</td>" +
                "<th>Team (D1)</th><td>" + v(fields.team.value) + "</td></tr>" +
            "</table>";
    }

    // ---------- action tracker (8D D5/D6/D7) ----------
    function actionTableHtml(kind) {
        return '<table class="rca-act" data-kind="' + kind + '">' +
            "<tr><th style='width:34px'>#</th><th>Action</th><th style='width:120px'>Owner</th>" +
            "<th style='width:110px'>Target date</th><th style='width:110px'>Status</th><th style='width:150px'>Evidence</th></tr>" +
            [1, 2].map((i) => "<tr><td>" + i + "</td><td contenteditable='true'></td><td contenteditable='true'></td>" +
                "<td contenteditable='true'></td><td contenteditable='true'></td><td contenteditable='true'></td></tr>").join("") +
            "</table><button type='button' class='rca-addrow' data-kind='" + kind + "'>+ Add action row</button>";
    }

    // ---------- RPN before / after (FMEA link) ----------
    function rpnTableHtml() {
        return '<table class="rca-rpn">' +
            "<tr><th>&nbsp;</th><th>Severity (S)</th><th>Occurrence (O)</th><th>Detection (D)</th><th>RPN (S×O×D)</th></tr>" +
            "<tr><th>Before</th><td contenteditable='true'></td><td contenteditable='true'></td><td contenteditable='true'></td><td contenteditable='true'></td></tr>" +
            "<tr><th>After</th><td contenteditable='true'></td><td contenteditable='true'></td><td contenteditable='true'></td><td contenteditable='true'></td></tr>" +
            "</table>";
    }

    // ---------- evidence photos ----------
    function photosHtml() {
        if (!photos.length) return "";
        return '<div class="rca-evi">' +
            photos.map((p, i) => '<figure><img src="' + p + '" alt=""><figcaption>Photo ' + (i + 1) + "</figcaption></figure>").join("") +
            "</div>";
    }

    // Keep the report's evidence photographs in step with the photo tray when a
    // photo is added or removed after the report was made (they used to appear
    // only after generating the report again).
    function refreshEvidencePhotos() {
        if (reportBox.hidden) return;
        const sec = Array.prototype.find.call(reportBox.querySelectorAll(".rca-sec"),
            (s) => /^\s*2\./.test(((s.querySelector("h3") || {}).textContent) || ""));
        if (!sec) return;
        const old = sec.querySelector(".rca-evi");
        const block = old ? old.closest(".rca-fish") : null;
        if (!photos.length) { if (block) block.remove(); save(); return; }
        const html = '<div class="rca-fish">' + photosHtml() + '<div class="rca-fish-cap">Evidence photographs</div></div>';
        if (block) block.outerHTML = html;
        else sec.insertAdjacentHTML("beforeend", html);
        save();
    }

    function renderPhotoTray() {
        photosBox.innerHTML = photos.map((p, i) =>
            '<div class="rca-thumb"><img src="' + p + '" alt=""><button type="button" data-i="' + i + '" title="Remove">×</button></div>'
        ).join("");
        photosBox.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
            photos.splice(parseInt(b.dataset.i, 10), 1); renderPhotoTray(); save(); refreshEvidencePhotos();
        }));
    }

    // ---------- Fishbone (Ishikawa) diagram ----------
    // 6M in the company 8D layout: top row Man / Material / Method, bottom row
    // Machine / Money / Mother Nature.
    const SIX_M = ["Man", "Material", "Method", "Machine", "Money", "Mother Nature"];

    // Pull "Man: a; b; c" lines out of the AI's section-5 text.
    function parse6M(raw) {
        const cats = SIX_M.map((n) => ({ name: n, causes: [] }));
        String(raw || "").split(/\r?\n/).forEach((ln) => {
            const t = ln.replace(/^[\s\-*•\d.)]+/, "").replace(/\*\*/g, "").trim();
            const m = t.match(/^(Man|Machine|Material|Method|Measurement|Money|Environment|Mother\s*Nature)\s*[:\-–]\s*(.+)$/i);
            if (!m) return;
            let name = m[1];
            // Map the classic 6M onto this layout's labels.
            if (/mother\s*nature|environment/i.test(name)) name = "Mother Nature";
            else if (/measurement/i.test(name)) name = "Method";   // fold Measurement into Method
            else name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
            const cat = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
            if (!cat) return;
            m[2].split(/;|,(?![^()]*\))/).forEach((c) => {
                c = c.replace(/\((confirmed|ruled[\s-]?out|needs?[\s-]?check)\)/i, "$&").trim();
                if (c && cat.causes.length < 4) cat.causes.push(c);
            });
        });
        return cats;
    }

    function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

    // Wrap the effect text into <tspan> lines inside the head box.
    function headLines(text, max, maxLines) {
        const words = String(text || "Problem").split(/\s+/);
        const lines = []; let cur = "";
        words.forEach((w) => {
            if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur); cur = w; }
            else cur = (cur + " " + w).trim();
        });
        if (cur) lines.push(cur);
        if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = trunc(lines[maxLines - 1], max); }
        return lines;
    }

    function fishboneSvg(cats, effect) {
        // Wide-but-short layout: full page width keeps the labels readable, while a
        // small height lets the diagram flow inline (no orphan page, border stays neat).
        const W = 1010, H = 392, spineY = H / 2, startX = 55, headX = W - 195;
        const boneLen = 150, dx = 92, colStep = 205;
        let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fish-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fishbone diagram">';
        // Black on white, like the rest of the document (it used to be blue/red).
        s += '<defs><marker id="fbArrow" markerWidth="10" markerHeight="10" refX="8" refY="3.5" orient="auto">' +
             '<path d="M0,0 L8,3.5 L0,7 z" fill="#000"/></marker></defs>';
        // spine
        s += '<line x1="' + startX + '" y1="' + spineY + '" x2="' + (headX - 8) + '" y2="' + spineY +
             '" stroke="#000" stroke-width="2" marker-end="url(#fbArrow)"/>';
        // head = the effect / problem (white box, red outline — matches the NEMO template)
        const bw = 175, bh = 96;
        s += '<rect x="' + headX + '" y="' + (spineY - bh / 2) + '" width="' + bw + '" height="' + bh +
             '" fill="#ffffff" stroke="#000" stroke-width="1"/>';
        const hl = headLines(effect, 22, 4);
        hl.forEach((ln, i) => {
            s += '<text x="' + (headX + bw / 2) + '" y="' + (spineY - (hl.length - 1) * 8 + i * 16) +
                 '" text-anchor="middle" fill="#000" font-size="13.5" font-weight="700">' + esc(ln) + "</text>";
        });
        // bones
        cats.forEach((c, i) => {
            const top = i < 3, slot = i % 3;
            const bx = startX + 150 + slot * colStep;
            const tipX = bx - dx, tipY = top ? spineY - boneLen : spineY + boneLen;
            s += '<line x1="' + bx + '" y1="' + spineY + '" x2="' + tipX + '" y2="' + tipY +
                 '" stroke="#000" stroke-width="1.5"/>';
            // category label: white box, black outline
            const lw = 112, lh = 27, ly = top ? tipY - lh : tipY;
            s += '<rect x="' + (tipX - lw / 2) + '" y="' + ly + '" width="' + lw + '" height="' + lh +
                 '" fill="#ffffff" stroke="#000" stroke-width="1"/>';
            s += '<text x="' + tipX + '" y="' + (ly + 18.5) + '" text-anchor="middle" fill="#000" font-size="14.5" font-weight="700">' +
                 esc(c.name) + "</text>";
            // causes as ticks along the bone (kept short so each stays inside its column)
            // Up to 4 causes (the AI is asked for 2 to 4; the 4th used to be left
            // off the diagram). Four are spaced a little closer to fit the bone.
            const list = (c.causes.length ? c.causes : ["—"]).slice(0, 4);
            list.forEach((cause, j) => {
                const t = list.length > 3 ? 0.22 + j * 0.2 : 0.30 + j * 0.24;
                const px = bx + (tipX - bx) * t, py = spineY + (tipY - spineY) * t;
                s += '<line x1="' + px + '" y1="' + py + '" x2="' + (px + 28) + '" y2="' + py +
                     '" stroke="#000" stroke-width="1"/>';
                const causeTxt = String(cause).replace(/\s*\([^)]*\)\s*$/, "").trim();  // drop "(Confirmed)/(Ruled-out)" tail
                s += '<text x="' + (px + 32) + '" y="' + (py + 4.5) + '" font-size="16" fill="#000">' +
                     esc(trunc(causeTxt || cause, 20)) + "</text>";
            });
        });
        s += "</svg>";
        return s;
    }

    function sixMTableHtml(cats) {
        return '<table class="rca-6m-table"><tr><th>Category (6M)</th><th>Possible causes</th></tr>' +
            cats.map((c) => "<tr><th>" + esc(c.name) + "</th><td>" +
                (c.causes.length ? c.causes.map(esc).join("; ") : "—") + "</td></tr>").join("") +
            "</table>";
    }

    // ---------- IS / IS-NOT matrix ----------
    const ISNOT_ROWS = ["What", "Where", "When", "Extent", "Who"];

    function parseIsIsNot(raw) {
        const out = [];
        String(raw || "").split(/\r?\n/).forEach((ln) => {
            const t = ln.replace(/^[\s\-*•\d.)]+/, "").replace(/\*\*/g, "").trim();
            const m = t.match(/^(What|Where|When|Extent|Who|How\s*many)\s*[:\-–]\s*(.+?)\s*\|\s*(.+)$/i);
            if (!m) return;
            const name = m[1].replace(/how\s*many/i, "Extent");
            out.push({ k: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(), is: m[2].trim(), not: m[3].trim() });
        });
        return out;
    }

    function isIsNotTableHtml(rows) {
        if (!rows.length) return "";
        return '<table class="rca-isnot"><tr><th>Dimension</th><th>IS (where the problem occurs)</th><th>IS NOT (where it does not)</th></tr>' +
            rows.map((r) => "<tr><th>" + esc(r.k) + "</th><td>" + esc(r.is) + "</td><td>" + esc(r.not) + "</td></tr>").join("") +
            "</table>";
    }

    // ---------- 5-Why chain diagram ----------
    const WHY_LEGS = ["Occurrence", "Detection", "Systemic"];

    function parse5Why(raw) {
        const legs = [];
        String(raw || "").split(/\r?\n/).forEach((ln) => {
            const t = ln.replace(/^[\s\-*•\d.)]+/, "").replace(/\*\*/g, "").trim();
            const m = t.match(/^(Occurrence|Detection|Systemic)\s*(?:leg)?\s*[:\-–]\s*(.+)$/i);
            if (!m) return;
            const name = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
            const steps = m[2].split(/->|→|=>|→/).map((s) => s.trim()).filter(Boolean);
            if (steps.length > 1) legs.push({ name: name, steps: steps.slice(0, 6) });
        });
        return legs;
    }

    function fiveWhySvg(legs) {
        const W = 1080, rowH = 132, H = 26 + legs.length * rowH;
        let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="rca-diagram why-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="5-Why diagram">';
        s += '<defs><marker id="whyArrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">' +
             '<path d="M0,0 L7,3 L0,6 z" fill="#64748b"/></marker></defs>';
        legs.forEach((leg, li) => {
            const y = 22 + li * rowH, n = leg.steps.length;
            // leg label
            s += '<rect x="6" y="' + (y + 18) + '" width="112" height="42" rx="7" fill="#0F4C81"/>';
            s += '<text x="62" y="' + (y + 44) + '" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="700">' + esc(leg.name) + "</text>";
            const x0 = 128, avail = W - x0 - 12, gap = 16;
            const bw = Math.max(96, (avail - gap * (n - 1)) / n), bh = 78;
            leg.steps.forEach((st, i) => {
                const bx = x0 + i * (bw + gap), last = (i === n - 1);
                s += '<rect x="' + bx + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="8" fill="' +
                     (last ? "#b91c1c" : "#eef2ff") + '" stroke="' + (last ? "#7f1d1d" : "#2563eb") + '" stroke-width="1.4"/>';
                s += '<text x="' + (bx + 7) + '" y="' + (y + 14) + '" font-size="9" font-weight="700" fill="' +
                     (last ? "#fecaca" : "#2563eb") + '">' + (last ? "ROOT CAUSE" : "WHY " + (i + 1)) + "</text>";
                const lines = headLines(st, Math.max(14, Math.floor(bw / 5.4)), 4);
                lines.forEach((ln, j) => {
                    s += '<text x="' + (bx + 7) + '" y="' + (y + 30 + j * 12) + '" font-size="9.5" fill="' +
                         (last ? "#fff" : "#1f2937") + '">' + esc(ln) + "</text>";
                });
                if (!last) {
                    const ax = bx + bw, ay = y + bh / 2;
                    s += '<line x1="' + (ax + 2) + '" y1="' + ay + '" x2="' + (ax + gap - 4) + '" y2="' + ay +
                         '" stroke="#64748b" stroke-width="1.6" marker-end="url(#whyArrow)"/>';
                }
            });
        });
        s += "</svg>";
        return s;
    }

    // ---------- Pareto chart ----------
    function parsePareto(raw) {
        const out = [];
        String(raw || "").split(/\r?\n/).forEach((ln) => {
            const t = ln.replace(/^[\s\-*•\d.)]+/, "").replace(/\*\*/g, "").trim();
            const m = t.match(/^pareto\s*[:\-–]\s*(.+)$/i);
            if (!m) return;
            m[1].split(/;/).forEach((p) => {
                const q = p.split(/=|:/);
                if (q.length < 2) return;
                const n = parseFloat(q[1].replace(/[^\d.]/g, ""));
                if (q[0].trim() && !isNaN(n)) out.push({ label: q[0].trim(), n: n });
            });
        });
        return out.sort((a, b) => b.n - a.n).slice(0, 8);
    }

    function paretoSvg(data) {
        const W = 1080, H = 400, L = 58, R = 58, T = 22, B = 96;
        const pw = W - L - R, ph = H - T - B;
        const total = data.reduce((a, d) => a + d.n, 0) || 1;
        const max = Math.max.apply(null, data.map((d) => d.n));
        let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="rca-diagram pareto-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pareto chart">';
        // axes
        s += '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (T + ph) + '" stroke="#334155" stroke-width="1.4"/>';
        s += '<line x1="' + L + '" y1="' + (T + ph) + '" x2="' + (L + pw) + '" y2="' + (T + ph) + '" stroke="#334155" stroke-width="1.4"/>';
        // gridlines + left axis (counts)
        for (let g = 0; g <= 4; g++) {
            const yy = T + ph - (ph * g / 4), val = Math.round(max * g / 4);
            s += '<line x1="' + L + '" y1="' + yy + '" x2="' + (L + pw) + '" y2="' + yy + '" stroke="#e2e8f0" stroke-width="1"/>';
            s += '<text x="' + (L - 8) + '" y="' + (yy + 3.5) + '" text-anchor="end" font-size="9.5" fill="#64748b">' + val + "</text>";
            s += '<text x="' + (L + pw + 8) + '" y="' + (yy + 3.5) + '" font-size="9.5" fill="#64748b">' + (g * 25) + "%</text>";
        }
        const bw = pw / data.length, bar = Math.min(74, bw * 0.62);
        let cum = 0; const pts = [];
        data.forEach((d, i) => {
            const cx = L + bw * i + bw / 2;
            const h = (d.n / max) * ph, by = T + ph - h;
            s += '<rect x="' + (cx - bar / 2) + '" y="' + by + '" width="' + bar + '" height="' + h + '" rx="3" fill="#2563eb"/>';
            s += '<text x="' + cx + '" y="' + (by - 5) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#1f2937">' + d.n + "</text>";
            cum += d.n;
            pts.push([cx, T + ph - (cum / total) * ph]);
            headLines(d.label, 16, 3).forEach((ln, j) => {
                s += '<text x="' + cx + '" y="' + (T + ph + 14 + j * 11) + '" text-anchor="middle" font-size="9" fill="#334155">' + esc(ln) + "</text>";
            });
        });
        // cumulative line
        s += '<polyline points="' + pts.map((p) => p[0] + "," + p[1]).join(" ") + '" fill="none" stroke="#dc2626" stroke-width="2"/>';
        pts.forEach((p, i) => {
            s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" fill="#dc2626"/>';
            const pct = Math.round(((i === 0 ? data[0].n : data.slice(0, i + 1).reduce((a, d) => a + d.n, 0)) / total) * 100);
            s += '<text x="' + p[0] + '" y="' + (p[1] - 7) + '" text-anchor="middle" font-size="9" fill="#dc2626" font-weight="700">' + pct + "%</text>";
        });
        s += '<text x="' + (L + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="#64748b">Defect mode (highest first) — bars = count, red line = cumulative %</text>';
        s += "</svg>";
        return s;
    }

    let lastCats = null;   // remembered for the Word export

    // Renders the report as a formal document; `content` maps section key -> HTML.
    // `dg` carries the parsed diagram data: {cats, isnot, legs, pareto}.
    function renderReport(content, dg) {
        dg = dg || {};
        content = content || {};
        lastCats = dg.cats || lastCats || parse6M("");
        const effect = fields.problem.value.trim() || "Problem";
        const plain = (h, n) => {
            const tmp = document.createElement("div"); tmp.innerHTML = String(h || "");
            let t = (tmp.textContent || "").replace(/\s+/g, " ").trim();
            if (n && t.length > n) t = t.slice(0, n - 1).trim() + "…";
            return t;
        };
        const ed = (v) => "<td contenteditable=\"true\">" + esc(v || "") + "</td>";
        const edKey = (k, v) => "<td class=\"rca-body editor rca-8d-cell\" contenteditable=\"true\" data-key=\"" + k + "\">" + (v || "") + "</td>";

        const logo = rcaLogoData();
        // No logo yet: a "click to add" box in the logo slot (never exported).
        const logoImg = rcaLogoMarkup(logo);

        // ---- Fishbone (6M) diagram for the Root-cause section ----
        const fishFig = '<div class="rca-fish">' + fishboneSvg(lastCats, effect) +
            '<div class="rca-fish-cap">Fishbone (6M) — possible causes</div></div>';
        // Editable 6M cause editor: rewrite the fishbone text here, then Redraw.
        const feRows = SIX_M.map((m) => {
            const cat = (lastCats || []).find((c) => c.name === m);
            const cs = cat ? cat.causes.map((x) => String(x).replace(/\s*\((confirmed|ruled[\s-]*out)\)\s*$/i, "").trim()).join("; ") : "";
            return "<tr><th class=\"rca-8d-lbl\">" + esc(m) + "</th><td contenteditable=\"true\" data-m=\"" + esc(m) + "\">" + esc(cs) + "</td></tr>";
        }).join("");
        const fishEditor = '<div class="rca-fe"><div class="rca-8d-subh">Edit fishbone causes — type causes separated by " ; " then press Redraw</div>' +
            '<table class="rca-8d-tbl rca-fe-tbl">' + feRows + '</table>' +
            '<button type="button" class="rca-redraw-fish">↻ Redraw fishbone</button></div>';

        // Root-cause table: seed rows from the confirmed causes.
        const causes = [];
        (lastCats || []).forEach((c) => (c.causes || []).forEach((cz) => causes.push(String(cz).replace(/\s*\((confirmed|ruled[\s-]*out)\)\s*$/i, "").trim())));
        const xCell = "<td class=\"rca-x\"><button type=\"button\" class=\"rca-delrow\" title=\"Remove this row\">×</button></td>";
        // AI-filled Cause / Spec / Investigation / Analysis, falling back to the
        // fishbone causes (and blank cells) when the model gave nothing.
        const fill = (dg && dg.fill) || {};
        const rcFill = fill.rootCause || [];
        const rcCount = Math.max(6, rcFill.length);
        let rcRows = "";
        for (let i = 0; i < rcCount; i++) {
            const r = rcFill[i] || [];
            rcRows += "<tr><td class=\"rc-sl\">" + (i + 1) + "</td>" +
                "<td contenteditable=\"true\">" + esc(r[0] || causes[i] || "") + "</td>" +
                "<td contenteditable=\"true\">" + esc(r[1] || "") + "</td>" +
                "<td contenteditable=\"true\">" + esc(r[2] || "") + "</td>" +
                "<td contenteditable=\"true\">" + esc(r[3] || "") + "</td>" + xCell + "</tr>";
        }

        // 5-Why legs -> Detection (why escaped) and Occurrence (how occurred).
        const legs = dg.legs || [];
        const legWhys = (re) => ((legs.find((l) => re.test(String(l.name || l.title || "")))) || {}).steps || [];
        const whyBlock = (whys) => {
            let s = "";
            // Every step the analysis has (up to 6), never fewer than 5 rows. Only 5
            // were shown, so a 6-step chain lost its last step - the root cause.
            for (let i = 0; i < Math.max(5, whys.length); i++) s += "<tr><th class=\"rca-why-lbl\">Why-" + (i + 1) + "</th><td contenteditable=\"true\">" + esc(whys[i] || "") + "</td>" +
                "<td class=\"rca-x\"><button type=\"button\" class=\"rca-delrow\" title=\"Remove this row\">×</button></td></tr>";
            return s;
        };

        // Permanent-action rows: AI action + owner, with a PLANNED target date and an
        // Open status. "Actual Date" is deliberately left blank - it records something
        // that has not happened yet, and an 8D must not carry invented completion data.
        const actFill = fill.actions || [];
        let paRows = "";
        const paCount = Math.max(5, actFill.length);
        for (let i = 0; i < paCount; i++) {
            const a = actFill[i] || [];
            const desc = a[0] ? (a[0] + (a[1] ? " (Owner: " + a[1] + ")" : "")) : (i === 0 && !actFill.length ? plain(content.corrective, 300) : "");
            paRows += "<tr><th class=\"rca-8d-lbl\">Action-" + (i + 1) + "</th>" +
                "<td contenteditable=\"true\">" + esc(desc) + "</td>" +
                "<td contenteditable=\"true\">" + esc(a[0] ? planDate(a[2]) : "") + "</td>" +
                "<td contenteditable=\"true\"></td>" +
                "<td contenteditable=\"true\">" + (a[0] ? "Open" : "") + "</td>" + xCell + "</tr>";
        }
        // Standardization / horizontal-deployment (shared row, no separate dates
        // for the deployment column) / effectiveness rows.
        const stdRow = (std, hd, plan) => "<tr><td contenteditable=\"true\">" + esc(std || "") + "</td>" +
            "<td contenteditable=\"true\">" + esc(hd || "") + "</td>" +
            "<td contenteditable=\"true\">" + esc(plan || "") + "</td><td contenteditable=\"true\"></td></tr>";
        const stdFill = fill.standard || [];
        let stdRows = "";
        if (stdFill.length) {
            stdFill.forEach((s) => { stdRows += stdRow(s[0], s[1], planDate(s[2])); });
            if (stdFill.length < 3) stdRows += stdRow("", "", "");
        } else {
            stdRows = stdRow(plain(content.preventive, 220), "", "") + stdRow("", "", "") + stdRow("", "", "");
        }
        let effRows = "";
        for (let i = 0; i < 4; i++) effRows += "<tr><td class=\"rc-sl\">" + (i + 1) + "</td><td contenteditable=\"true\"></td><td contenteditable=\"true\"></td><td contenteditable=\"true\"></td><td contenteditable=\"true\"></td><td contenteditable=\"true\"></td>" + xCell + "</tr>";

        let html =
            '<div class="rca-doc rca-doc-8d">' +
              // ---- header ----
              '<div class="rca-8d-head">' +
                '<div class="rca-8d-logo" title="Click to choose the logo image for this report (✕ removes it)">' + logoImg + '</div>' +
                '<div class="rca-8d-title">8D Report</div>' +
                '<table class="rca-8d-topbox">' +
                  '<tr><th>Rec. No.</th>' + ed(fields.no.value) + "</tr>" +
                  '<tr><th>Rev. No./Date</th>' + ed((fields.rev.value || "") + (fields.issue.value ? " / " + fields.issue.value : "")) + "</tr>" +
                  '<tr><th>Issued Date</th>' + ed(fields.issue.value) + "</tr>" +
                  // the Status chosen in the form (it was never shown in the report)
                  '<tr><th>Status</th><td contenteditable="true" data-rca-status="1">' + esc(fields.status.value || "Open") + "</td></tr>" +
                '</table>' +
              "</div>" +
              // ---- 1. Reference ----
              '<div class="rca-sec"><h3 class="rca-8d-h">1. Reference</h3>' +
                '<table class="rca-8d-tbl">' +
                  "<tr><th class=\"rca-8d-lbl\">Part No.</th>" + ed(fields.partNo.value) + "<th class=\"rca-8d-lbl\">Complaint source</th>" + ed(fields.where.value) + "</tr>" +
                  "<tr><th class=\"rca-8d-lbl\">Part Description</th>" + ed(fields.product.value) + "<th class=\"rca-8d-lbl\">Flash Report No.</th>" + ed(fields.flash.value) + "</tr>" +
                  "<tr><th class=\"rca-8d-lbl\">Model</th>" + ed(fields.model.value) + "<th class=\"rca-8d-lbl\">Complaint Qty</th>" + ed(fields.qty.value) + "</tr>" +
                  "<tr><th class=\"rca-8d-lbl\">Supplier</th>" + ed(fields.cust.value) + "<th class=\"rca-8d-lbl\">Reported date</th>" + ed(fields.date.value) + "</tr>" +
                "</table></div>" +
              // ---- 2. Problem Description ----
              '<div class="rca-sec"><h3 class="rca-8d-h">2. Problem Description</h3>' +
                '<table class="rca-8d-tbl">' +
                  '<tr><th class="rca-8d-lbl">Importance of the problem</th>' + edKey("importance", content.problem || "") + "</tr>" +
                  '<tr><th class="rca-8d-lbl">Theme &amp; target</th>' + edKey("theme", content.analysis || "") + "</tr>" +
                "</table>" +
                (photos.length ? ('<div class="rca-fish">' + photosHtml() + '<div class="rca-fish-cap">Evidence photographs</div></div>') : "") +
              "</div>" +
              // ---- 3. Interim Action ----
              '<div class="rca-sec"><h3 class="rca-8d-h">3. Interim Action</h3>' +
                '<table class="rca-8d-tbl">' +
                  '<tr><th class="rca-8d-lbl">a) Action on stock</th>' + edKey("interimstock", content.containment || "") + "</tr>" +
                  '<tr><th class="rca-8d-lbl">b) Additional temp detection control</th>' +
                    edKey("interimdetect", fill.interimDetect ? ("<p>" + esc(fill.interimDetect) + "</p>") : "") + "</tr>" +
                "</table></div>" +
              // ---- 4. Root cause ----
              '<div class="rca-sec"><h3 class="rca-8d-h">4. Root Cause</h3>' +
                fishFig + fishEditor +
                '<table class="rca-8d-tbl rca-rc-tbl" data-rownum="1"><tr><th class="rc-sl">SL No</th><th>Cause</th><th>Spec</th><th>Investigation</th><th>Analysis</th><th class="rca-x"></th></tr>' + rcRows + "</table>" +
                '<button type="button" class="rca-addrow">+ Add root-cause row</button>' +
                '<div class="rca-8d-subh">Detection (Why escaped)</div>' +
                '<table class="rca-8d-tbl rca-why-tbl" data-rowlabel="Why">' + whyBlock(legWhys(/detect/i)) + "</table>" +
                '<button type="button" class="rca-addrow">+ Add why</button>' +
                '<div class="rca-8d-subh">Occurrence (How occurred)</div>' +
                '<table class="rca-8d-tbl rca-why-tbl" data-rowlabel="Why">' + whyBlock(legWhys(/occur/i)) + "</table>" +
                '<button type="button" class="rca-addrow">+ Add why</button>' +
              "</div>" +
              // ---- 5. Permanent Action ----
              '<div class="rca-sec"><h3 class="rca-8d-h">5. Permanent Action</h3>' +
                '<table class="rca-8d-tbl rca-pa-tbl" data-rowlabel="Action"><tr><th class="rca-8d-lbl">&nbsp;</th><th>Action description</th><th>Plan Date</th><th>Actual Date</th><th>Status</th><th class="rca-x"></th></tr>' + paRows + "</table>" +
                '<button type="button" class="rca-addrow">+ Add action row</button></div>' +
              // ---- 6. Verification ----
              '<div class="rca-sec"><h3 class="rca-8d-h">6. Verification</h3>' +
                '<div class="rca-body editor rca-8d-area" contenteditable="true" data-key="verification">' + (content.verification || "") + "</div></div>" +
              // ---- 7. Standardization ----
              '<div class="rca-sec"><h3 class="rca-8d-h">7. Standardization</h3>' +
                '<table class="rca-8d-tbl rca-std-tbl">' +
                  '<tr><th>Standardization</th><th>Horizontal deployment</th><th>Plan Date</th><th>Actual Date</th></tr>' + stdRows +
                "</table>" +
                '<div class="rca-8d-subh">Effectiveness Monitoring</div>' +
                '<table class="rca-8d-tbl rca-eff-tbl" data-rownum="1"><tr><th class="rc-sl">Sl No</th><th>Invoice Number/Date</th><th>Qty</th><th>Status</th><th>Reason</th><th>Verified By</th><th class="rca-x"></th></tr>' + effRows + "</table>" +
                '<button type="button" class="rca-addrow">+ Add monitoring row</button></div>' +
              // ---- 8. Team Members & Approval ----
              '<div class="rca-sec"><h3 class="rca-8d-h">8. Team Members &amp; Approval (Congrats)</h3>' +
                '<table class="rca-8d-tbl rca-appr-tbl">' +
                  // Names come from the form. The "on" dates stay blank on purpose:
                  // they record when a sign-off actually happened, and an 8D is a
                  // quality record - it must not carry a date for something not done.
                  "<tr><th class=\"rca-8d-lbl\">Updated by</th>" + ed(fields.by.value) + "<th class=\"rca-8d-lbl\">Updated on</th>" + ed(fields.issue.value) + "</tr>" +
                  "<tr><th class=\"rca-8d-lbl\">Approved by</th>" + ed(fields.approver.value) + "<th class=\"rca-8d-lbl\">Approved on</th>" + ed("") + "</tr>" +
                  "<tr><th class=\"rca-8d-lbl\">M3plan (Permanent)</th>" + ed("") + "<th class=\"rca-8d-lbl\">M3actual (Permanent)</th>" + ed("") + "</tr>" +
                  "<tr><th class=\"rca-8d-lbl\">Verified by (BNC)</th>" + ed(fields.verifier.value) + "<th class=\"rca-8d-lbl\">Verified on (BNC)</th>" + ed("") + "</tr>" +
                "</table>" +
                '<div class="rca-8d-team"><span class="rca-8d-lbl">Team members (D1):</span> ' +
                '<span class="rca-body editor" contenteditable="true" data-key="team">' + esc(fields.team.value || "") + "</span></div></div>" +
              '<div class="rca-doc-foot">' + (fields.product.value.trim() ? esc(fields.product.value.trim()) + " — " : "") +
                "8D Report · Rec. No. " + (esc(fields.no.value.trim()) || "—") + " · Rev " + (esc(fields.rev.value.trim()) || "—") + "</div>" +
            "</div>";

        reportBox.innerHTML = html;
        reportBox.hidden = false;
        syncRcaTools();
        reportBox.scrollIntoView({ behavior: "smooth", block: "start" });
        bindReportControls();
        save();
    }

    // Wires up the controls inside the report: the editable text boxes, "↻ Redraw
    // fishbone", "+ Add row" and the per-row "×". Used for a newly made report AND
    // for one reopened from My RCAs. Reopened RCAs used to get their own, outdated
    // wiring that looked for a table layout the report no longer has, so their
    // add-row and redraw buttons did nothing.
    // The header box (Rec. No., Rev. No./Date, Issued Date, Status) and the form
    // fields are ONE value: the Word file, PDF running header and file name read
    // the form, the PDF body reads the box. Editing either now updates the other,
    // so every output shows the same number, revision and status.
    function headerCells() {
        const out = {};
        reportBox.querySelectorAll(".rca-8d-topbox tr").forEach((tr) => {
            const th = tr.querySelector("th"), td = tr.querySelector("td");
            if (!th || !td) return;
            const t = th.textContent.toLowerCase();
            const key = /rec/.test(t) ? "no" : /rev/.test(t) ? "revdate" : /issued/.test(t) ? "issue" : /status/.test(t) ? "status" : "";
            if (key) { td.dataset.hdr = key; out[key] = td; }
        });
        return out;
    }
    function headerFromFields(skip) {
        const c = headerCells();
        const set = (k, v) => { if (c[k] && c[k] !== skip && c[k].textContent !== v) c[k].textContent = v; };
        set("no", fields.no.value);
        set("revdate", (fields.rev.value || "") + (fields.issue.value ? " / " + fields.issue.value : ""));
        set("issue", fields.issue.value);
        set("status", fields.status.value || "Open");
        const foot = reportBox.querySelector(".rca-doc-foot");
        if (foot && /Rec\. No\./.test(foot.textContent)) {
            foot.textContent = (fields.product.value.trim() ? fields.product.value.trim() + " — " : "") +
                "8D Report · Rec. No. " + (fields.no.value.trim() || "—") + " · Rev " + (fields.rev.value.trim() || "—");
        }
    }
    function fieldsFromHeader(td) {
        const v = td.textContent.replace(/\s+/g, " ").trim();
        const k = td.dataset.hdr;
        if (k === "no") fields.no.value = v;
        else if (k === "issue") fields.issue.value = v;
        else if (k === "revdate") {
            const i = v.indexOf("/") >= 0 && /\s\/\s/.test(v) ? v.search(/\s\/\s/) : -1;
            fields.rev.value = i >= 0 ? v.slice(0, i).trim() : v;
            if (i >= 0) fields.issue.value = v.slice(i).replace(/^\s*\/\s*/, "").trim();
        } else if (k === "status") {
            const sel = fields.status;
            let opt = Array.prototype.find.call(sel.options, (o) => (o.value || o.text).toLowerCase() === v.toLowerCase());
            if (!opt && v) { opt = document.createElement("option"); opt.value = opt.text = v; sel.appendChild(opt); }
            if (opt) sel.value = opt.value;
        }
        headerFromFields(td);
        save();
    }

    function bindReportControls() {
        reportBox.querySelectorAll(".rca-body").forEach((el) => el.addEventListener("input", save));
        Object.values(headerCells()).forEach((td) => td.addEventListener("input", () => fieldsFromHeader(td)));

        // The header (and its logo slot) is rewritten by every render and by
        // reopening a saved RCA, so put the "⤢ Adjust" state back on the new button.
        syncRcaLogoAdjust();

        // Rewrite the fishbone: read the edited 6M causes and redraw the diagram.
        const redrawFish = () => {
            const cats = SIX_M.map((m) => ({ name: m, causes: [] }));
            reportBox.querySelectorAll(".rca-fe-tbl td[data-m]").forEach((td) => {
                const cat = cats.find((c) => c.name === td.dataset.m);
                if (!cat) return;
                (td.textContent || "").split(/;|\n/).map((s) => s.trim()).filter(Boolean).slice(0, 4).forEach((c) => cat.causes.push(c));
            });
            lastCats = cats;
            const oldSvg = reportBox.querySelector(".rca-fish svg.fish-svg");
            if (oldSvg) {
                const tmp = document.createElement("div");
                tmp.innerHTML = fishboneSvg(cats, fields.problem.value.trim() || "Problem");
                if (tmp.firstChild) oldSvg.replaceWith(tmp.firstChild);
            }
            save();
        };
        reportBox.querySelectorAll(".rca-redraw-fish").forEach((b) => b.addEventListener("click", redrawFish));

        // "+ Add row" on the root-cause / permanent-action / effectiveness tables.
        const isNumHdr = (s) => /^(sl\s*no|s\.?\s*no|#|no\.?)$/i.test(String(s || "").trim());
        const delBtnCell = "<td class='rca-x'><button type='button' class='rca-delrow' title='Remove this row'>×</button></td>";
        // Renumber a list table's first column: "Action-N" / "Why-N" or SL No.
        const renumber = (tbl) => {
            const noHeader = tbl.classList.contains("rca-why-tbl");
            const lbl = tbl.dataset.rowlabel, num = tbl.dataset.rownum;
            const start = noHeader ? 0 : 1;
            for (let i = start; i < tbl.rows.length; i++) {
                const c = tbl.rows[i].cells[0]; if (!c) continue;
                const n = i - start + 1;
                if (lbl) c.textContent = lbl + "-" + n;
                else if (num && !c.isContentEditable) c.textContent = n;
            }
        };
        reportBox.querySelectorAll(".rca-addrow").forEach((b) => b.addEventListener("click", () => {
            const tbl = (b.previousElementSibling && b.previousElementSibling.tagName === "TABLE") ? b.previousElementSibling : null;
            if (!tbl || !tbl.rows.length) return;
            const noHeader = tbl.classList.contains("rca-why-tbl");
            const lbl = tbl.dataset.rowlabel, num = tbl.dataset.rownum;
            const cols = tbl.rows[0].cells.length;
            const lastX = tbl.rows[0].cells[cols - 1].classList.contains("rca-x");
            const idx = (noHeader ? tbl.rows.length : tbl.rows.length - 1) + 1;
            const r = tbl.insertRow(-1);
            let cells = "";
            for (let i = 0; i < cols; i++) {
                if (i === 0 && lbl) cells += "<th class='" + (noHeader ? "rca-why-lbl" : "rca-8d-lbl") + "'>" + lbl + "-" + idx + "</th>";
                else if (i === 0 && num) cells += "<td class='rc-sl'>" + idx + "</td>";
                else if (i === cols - 1 && lastX) cells += delBtnCell;
                else cells += "<td contenteditable='true'></td>";
            }
            r.innerHTML = cells;
            save();
        }));
        // Per-row "×" delete (bind once); renumbers the label / SL No column afterwards.
        if (!reportBox.dataset.delBound) {
            reportBox.dataset.delBound = "1";
            reportBox.addEventListener("click", (e) => {
                const x = e.target.closest && e.target.closest(".rca-delrow");
                if (!x) return;
                const tr = x.closest("tr"), tbl = x.closest("table");
                if (!tr || !tbl) return;
                const noHeader = tbl.classList.contains("rca-why-tbl");
                if (tbl.rows.length <= (noHeader ? 1 : 2)) return;   // keep at least one data row
                tr.remove();
                renumber(tbl);
                save();
            });
        }
    }

    // Turn the AI's markdown-ish reply into per-section HTML (and keep the raw text,
    // which the Fishbone parser needs for the "Man: a; b" lines).
    function parseAI(text) {
        const html = {}, raw = {};
        const clean = (typeof cleanAIText === "function") ? cleanAIText(text) : String(text);
        const lines = clean.split(/\r?\n/);
        let cur = null, buf = [];
        const flush = () => {
            if (cur && buf.length) {
                raw[cur] = buf.join("\n");
                html[cur] = (typeof procMdToHtml === "function")
                    ? procMdToHtml(buf.join("\n")) : "<p>" + esc(buf.join(" ")) + "</p>";
            }
            buf = [];
        };
        // The words that identify each section title ("problem", "containment",
        // "fishbone", "5-why", ...). A numbered line is only a HEADING when its text
        // shares one of them: the AI's own numbered bullets inside a section
        // ("1. Quarantine the stock", "3. Check the mould log") used to be read as
        // headings of sections 1 and 3, cutting the report up and losing text.
        const STOP = /^(and|the|of|or|for|with|action|analysis|immediate)$/;
        const titleWords = SECTIONS.map((s) => s[1].toLowerCase()
            .replace(/^\d+\.\s*/, "").split(/[^a-z0-9-]+/)
            .filter((w) => w.length >= 4 && !STOP.test(w))
            .map((w) => w.replace(/-/g, "").slice(0, 6)));
        // "Root Cause Analysis — 5-Why" and "Corrective Action" have short keys.
        const extra = { why: ["5why", "why"], rootcause: ["root"], corrective: ["correc"], analysis: ["failur"] };
        const isHeading = (idx, text) => {
            const low = text.toLowerCase().replace(/-/g, "");
            const words = titleWords[idx].concat(extra[SECTIONS[idx][0]] || []);
            return words.some((w) => low.indexOf(w) >= 0);
        };
        lines.forEach((ln) => {
            const t = ln.trim().replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^section\s*/i, "").trim();
            const m = t.match(/^(\d{1,2})[.):]\s*(.+)$/);
            const idx = m ? parseInt(m[1], 10) - 1 : -1;
            const hit = m && SECTIONS[idx];
            if (hit && m[2].length < 70 && /[A-Za-z]/.test(m[2]) && isHeading(idx, m[2])) {
                flush(); cur = hit[0];
                // "3. Evidence: 12 parts cracked" - keep what follows the title.
                const rest = m[2].replace(/^[^:]*:\s*/, "");
                if (rest !== m[2] && rest.trim()) buf.push(rest);
                return;
            }
            if (cur) buf.push(ln);
        });
        flush();
        return { html: html, raw: raw };
    }

    function fallbackContent() {
        const p = fields.problem.value.trim() || "the reported failure";
        const prod = fields.product.value.trim() || "the product";
        return {
            problem: "<p>" + esc(p) + "</p><p><i>State it with IS / IS-NOT: what failed, where, when, how many, who found it.</i></p>",
            containment: "<ul><li>Quarantine the suspect stock in the plant, in transit and at the customer.</li><li>100% inspect / rework the suspect lot and mark the boundary lot numbers.</li><li>Record the containment date and who verified it.</li></ul>",
            evidence: "<ul><li>Collect the failed parts, test data, process parameters and batch records.</li><li>Check the 4M change history (Man, Machine, Material, Method) around the failure date.</li><li>Photograph the defect and compare a failed part with a good part.</li></ul>",
            analysis: "<p>Strip down and analyse " + esc(prod) + " — visual, dimensional, electrical and material checks — to establish the physical failure mode.</p>",
            fishbone: "<ul><li><b>Man:</b> —</li><li><b>Machine:</b> —</li><li><b>Material:</b> —</li><li><b>Method:</b> —</li><li><b>Measurement:</b> —</li><li><b>Environment:</b> —</li></ul>",
            why: "<p><b>Occurrence leg:</b> Why 1 → Why 2 → Why 3 → Why 4 → Why 5</p><p><b>Detection leg:</b> Why did our checks not catch it?</p><p><b>Systemic leg:</b> Why did the system allow it?</p>",
            rootcause: "<p><b>Occurrence:</b> —</p><p><b>Detection:</b> —</p><p><b>Systemic:</b> —</p>",
            corrective: "<p>Define a permanent action for each root-cause leg, with an owner and a due date. Prefer error-proofing over inspection.</p>",
            preventive: "<p>Update the PFMEA, control plan and work instruction, and apply the fix to all similar parts and lines (horizontal deployment).</p>",
            verification: "<p>Confirm with data (for example 0 defects in the next 3 lots / 30 days) that the action worked.</p>",
            conclusion: "<p>—</p>"
        };
    }

    // Parses a full RCA text (from the AI or from the built-in sample), builds every
    // diagram and renders the document. Returns the list of diagrams made, or null
    // if the text was unusable.
    // ---- structured tail blocks (TABLE-ROOTCAUSE / TABLE-ACTIONS / TABLE-STANDARD /
    // INTERIM-DETECT) -> the 8D tables, so the report comes back filled in. ----
    function parseFillBlocks(text) {
        const t = String(text || "");
        const grab = (name) => {
            const m = t.match(new RegExp(name + "\\s*:?\\s*\\r?\\n([\\s\\S]*?)(?=\\n\\s*(?:TABLE-[A-Z]+|INTERIM-DETECT)\\b|$)", "i"));
            if (!m) return [];
            return m[1].split(/\r?\n/)
                // List markers only ("- ", "* ", "1. ", "2) ") - not the digits of
                // the text itself ("48V connector", "100% HV test").
                .map((l) => l.replace(/^\s*(?:[-*•]\s*|\d{1,2}[.)]\s+)*/, "").trim())
                .filter((l) => l && l.indexOf("|") > 0 && !/^\(/.test(l))
                .map((l) => l.split("|").map((x) => x.replace(/\*\*/g, "").trim()));
        };
        const dm = t.match(/INTERIM-DETECT\s*:?\s*(.+)/i);
        return {
            rootCause: grab("TABLE-ROOTCAUSE").filter((r) => r.length >= 2),
            actions: grab("TABLE-ACTIONS").filter((r) => r.length >= 2),
            standard: grab("TABLE-STANDARD").filter((r) => r.length >= 2),
            interimDetect: dm ? dm[1].replace(/\*\*/g, "").trim() : ""
        };
    }

    // A planned target date = base date + N weeks. Only ever used for PLAN dates;
    // "actual" columns stay empty because those events have not happened yet -
    // an 8D is a quality record, so it must not carry invented completion data.
    function planDate(weeks) {
        const n = parseInt(weeks, 10);
        if (!isFinite(n) || n <= 0) return "";
        const dmy = (s) => {
            const m = String(s || "").match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
            if (!m) return null;
            const y = m[3].length === 2 ? 2000 + (+m[3]) : +m[3];
            const d = new Date(y, (+m[2]) - 1, +m[1]);
            return isNaN(d.getTime()) ? null : d;
        };
        const base = dmy(fields.issue.value) || dmy(fields.date.value) || new Date();
        const out = new Date(base.getTime() + n * 7 * 86400000);
        const p = (x) => String(x).padStart(2, "0");
        return p(out.getDate()) + "/" + p(out.getMonth() + 1) + "/" + out.getFullYear();
    }

    function buildFromText(text) {
        const parsed = parseAI(text);
        const content = parsed.html;
        const filled = Object.keys(content).filter((k) => (content[k] || "").trim()).length;
        if (filled < 4) { renderReport(fallbackContent(), { cats: parse6M("") }); return null; }

        const base = fallbackContent();
        SECTIONS.forEach(([k]) => { if (!content[k]) content[k] = base[k]; });

        // Build every diagram from the structured lines.
        const cats = parse6M(parsed.raw.fishbone || "");
        if (cats.some((c) => c.causes.length)) content.fishbone = sixMTableHtml(cats);
        const isnot = parseIsIsNot(parsed.raw.problem || "");
        const legs = parse5Why(parsed.raw.why || "");
        const pareto = parsePareto((parsed.raw.evidence || "") + "\n" + (parsed.raw.analysis || ""));

        // The raw data lines now live in their diagram/table, so strip them from the prose.
        const strip = (raw, re) => String(raw || "").split(/\r?\n/).filter((l) => !re.test(l.trim())).join("\n");
        const toHtml = (t) => (typeof procMdToHtml === "function") ? procMdToHtml(t) : "<p>" + esc(t) + "</p>";
        // The IS/IS-NOT and Pareto lines stay in the text: the report layout has no
        // IS/IS-NOT table or Pareto chart, and stripping them (as before) simply
        // deleted that analysis from the report.
        void strip; void toHtml;

        const fill = parseFillBlocks(text);
        renderReport(content, { cats: cats, isnot: isnot, legs: legs, pareto: pareto, fill: fill });
        // Name only what the report really shows (it used to also claim IS/IS-NOT
        // and Pareto diagrams that are not drawn).
        return ["Fishbone"].concat(legs.length ? ["5-Why"] : [],
            (fill.rootCause.length || fill.actions.length || fill.standard.length) ? ["filled tables"] : []);
    }

    // ---------- generate online ----------
    async function generate() {
        if (rcaBusy()) return;                        // a double click, or a PDF running
        const problem = fields.problem.value.trim();
        if (!problem) { setStatus("Describe the problem / failure first.", "err"); return; }

        // Generating replaces the report on screen, including everything typed
        // into it by hand - ask first, like opening a saved RCA would.
        if (!reportBox.hidden && reportBox.querySelector(".rca-body") &&
            !confirm("Generate a new RCA report?\n\nThis replaces the report on screen, including your edits. Save it first (Save RCA) if you need it.")) return;

        rcaGenerating = true;
        try { await generateNow(problem); }
        finally { rcaGenerating = false; }
    }

    async function generateNow(problem) {

        if (!navigator.onLine) {
            renderReport(fallbackContent(), { cats: parse6M("") });
            setStatus("You are offline — showing the standard RCA skeleton you can fill in.", "ok");
            return;
        }

        const provider = localStorage.getItem("aiProvider") || "free";
        const hasKey = !!(localStorage.getItem("aiKey") || "").trim();
        // Photos are analysed by Gemini/OpenAI (with key) OR the free OpenRouter
        // vision model. The free vision model is smaller, so send fewer images.
        const keyedVision = (provider === "gemini" || provider === "openai") && hasKey;
        // Downscale before sending: full-size phone photos make the request huge,
        // which is slow and pushes the free vision models past their limits.
        const pickImgs = photos.length ? photos.slice(0, keyedVision ? 3 : 2) : [];
        const sendImgs = [];
        for (const p of pickImgs) {
            try { sendImgs.push(await shrinkImage(p, 900, 0.82)); }
            catch (e) { sendImgs.push(p); }
        }

        const orig = genBtn.innerHTML;
        genBtn.disabled = true;
        genBtn.innerHTML = '<span class="btn-spin"></span> Generating…';
        reportBox.innerHTML = '<div class="cases-loading"><span class="spin"></span><span>' +
            (sendImgs.length ? "Analysing the failed-part photo(s) and writing the RCA report… this can take up to ~90 seconds on the free service." : "Analysing the failure and writing the full RCA report… this can take up to ~90 seconds on the free service.") +
            "</span></div>";
        reportBox.hidden = false;
        setStatus(sendImgs.length ? ("Generating the RCA report from your description and " + sendImgs.length + " photo(s)… (up to ~90s on the free service)") : "Generating the full RCA report online… (up to ~90s on the free service)");

        const ctx = [
            fields.product.value.trim() && ("Product/Part: " + fields.product.value.trim()),
            fields.partNo.value.trim() && ("Part/Drawing No: " + fields.partNo.value.trim()),
            fields.date.value.trim() && ("Date of occurrence: " + fields.date.value.trim()),
            fields.qty.value.trim() && ("Qty affected/Lot: " + fields.qty.value.trim()),
            fields.where.value.trim() && ("Detected at: " + fields.where.value.trim())
        ].filter(Boolean).join("\n");

        const prompt =
            "Write a complete engineering ROOT CAUSE ANALYSIS (RCA) report for this failure.\n\n" +
            (sendImgs.length ? "You are also given " + sendImgs.length + " PHOTOGRAPH(S) of the FAILED PART. Examine them carefully. " +
                "Describe exactly what the images show (the failure location, burn/crack/corrosion/wear marks, discolouration, fracture surface, contamination) " +
                "and USE those visual observations as evidence in Section 3 (Evidence) and Section 4 (Failure Analysis), and to support the causes and root cause. " +
                "Do not invent details that are not visible.\n\n" : "") +
            (ctx ? ctx + "\n" : "") +
            "Problem: " + problem + "\n\n" +
            "Use the 8D / 5-Why / Fishbone method. Reply with EXACTLY these 11 numbered sections, each heading on its own line:\n" +
            SECTIONS.map((s, i) => (i + 1) + ". " + s[1].replace(/^\d+\.\s*/, "")).join("\n") + "\n\n" +
            "Rules: be specific and technical to THIS product and failure - no generic filler. " +
            "Section 1: describe the problem, then add the IS / IS-NOT matrix as these exact lines (pipe separates IS from IS-NOT):\n" +
            "What: <is> | <is not>\nWhere: <is> | <is not>\nWhen: <is> | <is not>\nExtent: <is> | <is not>\nWho: <is> | <is not>\n" +
            "Section 3: after the evidence bullets add ONE line of Pareto data for the defect modes, exactly:\n" +
            "Pareto: mode=count; mode=count; mode=count; mode=count\n" +
            "(4 to 6 realistic defect modes with counts, highest first, short labels.)\n" +
            "Section 5 MUST use exactly this format - one line per category, causes separated by semicolons, nothing else:\n" +
            "Man: cause; cause; cause\nMaterial: cause; cause\nMethod: cause; cause\nMachine: cause; cause\nMoney: cause; cause\nMother Nature: cause; cause\n" +
            "(2 to 4 short causes per category, max 8 words each, each ending with (Confirmed) or (Ruled-out).)\n" +
            "Section 6 MUST give the three 5-Why chains as exactly these lines, arrows between whys, last item = the root cause:\n" +
            "Occurrence: why1 -> why2 -> why3 -> why4 -> root cause\nDetection: why1 -> why2 -> why3 -> root cause\nSystemic: why1 -> why2 -> why3 -> root cause\n" +
            "(each why max 9 words and provable.) " +
            "Section 7: state the three root causes clearly. " +
            "Section 8/9: give actions with an owner role and a due period, preferring error-proofing over inspection. " +
            "Section 10: give the data that proves effectiveness. " +
            "Use short bullet points or numbered lines. BE CONCISE - at most 2 to 4 short bullet points or lines per section, no long paragraphs. " +
            "No preamble, no reasoning, no markdown headers other than the numbered headings.\n\n" +
            // Structured tail: fills the 8D report's tables so the user does not have
            // to type them in by hand. Kept as plain pipe-separated lines because the
            // free models handle that far more reliably than JSON.
            "AFTER the 11 sections, add these four blocks EXACTLY as shown (same header words, " +
            "one record per line, fields separated by |). No extra commentary.\n\n" +
            "TABLE-ROOTCAUSE:\n" +
            "cause | specification or requirement | how it was investigated | result of the analysis\n" +
            "(one line per cause, 4 to 6 lines, matching the fishbone causes; " +
            "each field max 12 words; the analysis field must end with (Confirmed) or (Ruled-out).)\n\n" +
            "TABLE-ACTIONS:\n" +
            "permanent corrective action | owner role | weeks\n" +
            "(3 to 5 lines, 'weeks' is a whole number of weeks to complete, error-proofing first.)\n\n" +
            "TABLE-STANDARD:\n" +
            "standardisation item (PFMEA, control plan, work instruction, checklist) | where to deploy it across similar parts or lines | weeks\n" +
            "(2 to 4 lines, 'weeks' a whole number.)\n\n" +
            "INTERIM-DETECT: <one short sentence: the extra temporary detection control " +
            "put in place until the permanent action is effective>";

        try {
            let text;
            try {
                text = await aiComplete(prompt, "You are a senior quality engineer writing formal 8D / RCA reports for automotive & EV manufacturing. When photos of the failed part are provided, analyse them and use what you see as evidence. Be specific and technical. Output only the 11 numbered sections.", false, sendImgs, 90000);
            } catch (e) {
                if ((localStorage.getItem("aiProvider") || "free") === "free") throw e;
                text = await aiComplete(prompt, "You are a senior quality engineer writing formal 8D / RCA reports. Output only the 11 numbered sections.", true);
                // Kept for the final message - shown on its own it was overwritten
                // straight away by the "generated" status below.
                var fellBackNote = " (Your AI provider errored, so the free assistant was used — photos were not analysed.)";
            }
            const made = buildFromText(text);
            if (!made) {
                setStatus("The AI answer wasn't usable — showing the standard RCA skeleton, which you can fill in and edit. Try Generate again in a moment." + (fellBackNote || ""), "ok");
                return;
            }
            setStatus("RCA report generated" + (sendImgs.length ? " from your description + " + sendImgs.length + " photo(s)" : "") +
                " with " + made.join(", ") + ". Every section is editable — check it before you download." + (fellBackNote || ""), "ok");
        } catch (e) {
            renderReport(fallbackContent(), { cats: parse6M("") });
            setStatus("Could not generate online (" + e.message + ") — showing the standard RCA skeleton you can fill in.", "err");
        } finally {
            genBtn.disabled = false;
            genBtn.innerHTML = orig;
        }
    }

    // True (and says why) while the report must not be replaced, saved or cleared:
    // a PDF is being rendered from it, or Generate is still writing it (Clear or
    // Load sample during Generate was undone when the answer landed).
    let rcaGenerating = false;
    function rcaBusy() {
        if (rcaGenerating) { setStatus("Please wait - the RCA report is still being generated.", "err"); return true; }
        if (rcaPdfBusy) { setStatus("Please wait - the PDF is still being built from this report.", "err"); return true; }
        return false;
    }

    // ---------- persistence ----------
    function save() {
        try {
            const body = {};
            reportBox.querySelectorAll(".rca-body").forEach((el) => { body[el.dataset.key] = el.innerHTML; });
            // The evidence photos are deliberately NOT kept here. rcaState is
            // written on every keystroke and nothing reads it back (the RCA is
            // restored from "Save RCA" / My RCAs, by design), so storing photo
            // data URLs in it only filled the browser's storage and made real
            // saves fail sooner.
            localStorage.setItem("rcaState", JSON.stringify({
                f: Object.keys(fields).reduce((a, k) => (a[k] = fields[k].value, a), {}),
                body: body, shown: !reportBox.hidden
            }));
        } catch (e) { /* ignore */ }
    }

    // ---------- download as Word (formal document, diagrams embedded as images) ----------
    async function download() {
        if (reportBox.hidden) { setStatus("Generate the RCA report first.", "err"); return; }
        setStatus("Building the Word document…");
        const th = "border:1px solid #000;padding:5px;background:#F2F2F2;text-align:left;font-weight:bold;";
        const td = "border:1px solid #000;padding:5px;";
        const v = (x) => (x && x.trim()) ? esc(x.trim()) : "&nbsp;";

        // Rasterise the diagrams so they embed as pictures in Word.
        let imgs = [];
        try { imgs = await allDiagramImages(); } catch (e) { imgs = []; }
        // Serialise every .rca-fish block in a section (diagram picture, table, or photos).
        const fishFor = (sec) => {
            let out = "";
            sec.querySelectorAll(".rca-fish").forEach((f) => {
                const cap = f.querySelector(".rca-fish-cap");
                const capHtml = cap ? "<div style='font-size:9pt;color:#666;'>" + esc(cap.textContent) + "</div>" : "";
                const svg = f.querySelector("svg.fish-svg, svg.rca-diagram");
                const table = f.querySelector("table");
                const evi = f.querySelector(".rca-evi");
                if (svg) {
                    const hit = imgs.find((d) => d.el === svg);
                    if (hit) out += "<div style='text-align:center;margin:6px 0;'><img src='" + hit.url + "' style='width:100%;max-width:660px;'/>" + capHtml + "</div>";
                } else if (table) {
                    out += "<div style='margin:6px 0;'>" + table.outerHTML + capHtml + "</div>";
                } else if (evi) {
                    out += "<div style='text-align:center;margin:6px 0;'>" + evi.innerHTML + capHtml + "</div>";
                }
            });
            return out;
        };

        const logo = rcaLogoData();
        // Panned / zoomed as "⤢ Adjust" shows it: Word has no CSS transform, so
        // the picture itself is redrawn with the crop baked in.
        const logoBaked = logo ? await rcaLogoBaked(150, 44) : null;
        const logoImg = logoBaked
            ? "<img src='" + logoBaked.url + "' style='height:44px;width:150px;'>"
            : (logo ? "<img src='" + logo + "' style='height:44px;'>" : "");
        const recCell = "border:1px solid #000;padding:3px 5px;font-size:8.5pt;";
        // Header row: logo (left) | "8D Report" (centre, underlined) | Rec/Rev/Issued box (right)
        let body =
            "<table style='border-collapse:collapse;width:100%;margin:0;table-layout:fixed;'><tr>" +
              "<td style='border:none;width:24%;vertical-align:middle;padding:2pt 4pt;'>" + logoImg + "</td>" +
              "<td style='border:none;width:46%;text-align:center;vertical-align:middle;'>" +
                "<span style='font-size:20pt;font-weight:bold;text-decoration:underline;'>8D Report</span></td>" +
              "<td style='border:none;width:30%;vertical-align:top;padding:2pt 0;'>" +
                "<table style='border-collapse:collapse;width:100%;'>" +
                  "<tr><td style=\"" + recCell + "font-weight:bold;width:50%;\">Rec.No.:</td><td style=\"" + recCell + "\">" + v(fields.no.value) + "</td></tr>" +
                  "<tr><td style=\"" + recCell + "font-weight:bold;\">Rev. No./Date:</td><td style=\"" + recCell + "\">" + v((fields.rev.value || "") + (fields.issue.value ? " / " + fields.issue.value : "")) + "</td></tr>" +
                  "<tr><td style=\"" + recCell + "font-weight:bold;\">Status:</td><td style=\"" + recCell + "\">" + v(fields.status.value || "Open") + "</td></tr>" +
                  "<tr><td style=\"" + recCell + "font-weight:bold;\">Issued Date:</td><td style=\"" + recCell + "\">" + v(fields.issue.value) + "</td></tr>" +
                "</table>" +
              "</td>" +
            "</tr></table>";

        // One .rca-fish block -> its diagram picture / table / photos.
        const fishChild = (fishEl) => {
            const cap = fishEl.querySelector(".rca-fish-cap");
            const capHtml = cap ? "<div style='font-size:9pt;color:#666;'>" + esc(cap.textContent) + "</div>" : "";
            const svg = fishEl.querySelector("svg.fish-svg, svg.rca-diagram");
            const table = fishEl.querySelector("table");
            const evi = fishEl.querySelector(".rca-evi");
            if (svg) {
                const hit = imgs.find((d) => d.el === svg);
                if (hit) return "<div style='text-align:center;margin:2px 0;page-break-inside:avoid;'><img src='" + hit.url + "' width='700' style='width:700px;max-width:100%;'/>" + capHtml + "</div>";
                return "<div style='text-align:center;margin:2px 0;font-style:italic;color:#900;'>[Diagram could not be embedded — see the on-screen report]</div>";
            }
            if (table) return "<div style='margin:0;'>" + table.outerHTML + capHtml + "</div>";
            if (evi) {
                // Cap each photo so it stays a thumbnail rather than a full-width block.
                const cl = evi.cloneNode(true);
                cl.querySelectorAll("img").forEach((im) => {
                    im.setAttribute("width", "260");
                    im.style.cssText = "width:260px;max-width:260px;height:auto;margin:3px;";
                });
                return "<div style='text-align:center;margin:3px 0;'>" + cl.innerHTML + capHtml + "</div>";
            }
            return "";
        };
        // Walk each section's children in order so the 8D layout is preserved.
        reportBox.querySelectorAll(".rca-sec").forEach((sec) => {
            const h = sec.querySelector("h3");
            body += "<div style='border:1px solid #000;background:#fff;color:#000;padding:4px 8px;font-weight:bold;font-size:11.5pt;margin-top:0;'>" +
                    esc(h ? h.textContent : "") + "</div>";
            Array.prototype.forEach.call(sec.children, (child) => {
                if (child.tagName === "H3") return;
                if (child.classList && child.classList.contains("rca-fish")) body += fishChild(child);
                else if (child.tagName === "TABLE") {
                    const tc = child.cloneNode(true);                        // drop on-screen "×" column + buttons
                    tc.querySelectorAll(".rca-x").forEach((c) => c.remove());
                    tc.querySelectorAll("button").forEach((btn) => btn.remove());
                    // Uniform first-column width so every table's data lines up in Word.
                    tc.querySelectorAll("tr").forEach((tr) => {
                        const c0 = tr.querySelector("th, td");
                        if (c0) { c0.setAttribute("width", "22%"); c0.style.width = "22%"; }
                    });
                    body += "<div style='margin:0;'>" + tc.outerHTML + "</div>";
                }
                else if (child.classList && child.classList.contains("rca-8d-subh")) body += "<div style='font-weight:bold;margin:4px 0 2px;font-size:11pt;'>" + esc(child.textContent) + "</div>";
                else if (child.classList && (child.classList.contains("rca-8d-area") || child.classList.contains("rca-body"))) body += "<div style='padding:3px 2px;font-size:11pt;min-height:28px;'>" + child.innerHTML + "</div>";
                else if (child.classList && child.classList.contains("rca-8d-team")) body += "<div style='margin-top:6px;font-size:11pt;'>" + child.innerHTML + "</div>";
            });
        });

        // Doc-control footer.
        body += "<hr><table style='width:100%;border:none;font-size:9pt;color:#555;'><tr>" +
            "<td style='border:none;'>Rec. No.: " + esc(fields.no.value.trim() || "—") + " &nbsp; Rev: " + esc(fields.rev.value.trim() || "00") + "</td>" +
            "<td style='border:none;text-align:center;'>8D Report — Confidential</td>" +
            "<td style='border:none;text-align:right;'>Issued: " + esc(fields.issue.value.trim() || new Date().toLocaleDateString()) + "</td></tr></table>";

        let doc = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><style>" +
              // 2cm / 2.2cm, matching the real .docx and the PDF. This used to be
              // 1.05cm, so the fallback .doc came out with half the margin of
              // every other export of the same report.
              "@page Section1 { size:21cm 29.7cm; margin:2cm 2cm 2.2cm 2cm; mso-page-orientation:portrait; }" +
              "div.Section1 { page:Section1; }" +
              "body { margin:0; }" +
              "table { border-collapse:collapse; width:100%; margin:0; table-layout:fixed; }" +
              "td, th { border:1px solid #000; padding:5px; text-align:left; vertical-align:top; word-wrap:break-word; }" +
              "th { background:#F2F2F2; text-align:center; vertical-align:middle; }" +
              // Per-page border frame: a single-cell table repeats its border on every page.
              "table.pgframe { table-layout:auto; width:100%; margin:0; }" +
              "td p { margin:4px 0; } td ul { margin:4px 0; padding-left:18px; } td li { margin:2px 0; }" +
              "img { max-width:100%; }" +
              // black, so every rule in the document is the same colour
              "hr { border:none; border-top:1px solid #000; }" +
            "</style></head>" +
            "<body style=\"font-family:'Times New Roman',serif;font-size:11pt;line-height:1.4;\">" +
            "<div class=\"Section1\"><table class=\"pgframe\"><tr>" +
            "<td style=\"border:1.5pt solid #000000;padding:0;vertical-align:top;\">" + body +
            "</td></tr></table></div></body></html>";

        // Word (the HTML .doc format) does NOT render base64 data-URI images.
        // Package the file as MHTML instead: every image becomes a proper MIME
        // part that Word displays reliably, referenced by an absolute URL.
        const base = "http://bnc.local/rca/";
        const parts = [];
        doc = doc.replace(/src\s*=\s*(["'])data:image\/([a-z+]+);base64,([^"']+)\1/gi, (m, q, mime, b64) => {
            const ext = (mime === "jpeg") ? "jpg" : mime.replace("+xml", "");
            const name = "img" + (parts.length + 1) + "." + ext;
            parts.push({ loc: base + name, mime: "image/" + (mime === "svg" ? "svg+xml" : mime), b64: b64 });
            return "src=" + q + base + name + q;
        });

        const boundary = "----=_NextPart_BNC_RCA_8D";
        let mht = "MIME-Version: 1.0\r\n" +
            "Content-Type: multipart/related; type=\"text/html\"; boundary=\"" + boundary + "\"\r\n\r\n" +
            "--" + boundary + "\r\n" +
            "Content-Type: text/html; charset=\"utf-8\"\r\n" +
            "Content-Location: " + base + "report.html\r\n\r\n" +
            doc + "\r\n\r\n";
        parts.forEach((p) => {
            mht += "--" + boundary + "\r\n" +
                "Content-Type: " + p.mime + "\r\n" +
                "Content-Transfer-Encoding: base64\r\n" +
                "Content-Location: " + p.loc + "\r\n\r\n" +
                p.b64.replace(/(.{76})/g, "$1\r\n") + "\r\n\r\n";
        });
        mht += "--" + boundary + "--\r\n";

        const blob = new Blob([mht], { type: "application/msword" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const nm = (fields.product.value.trim() || "RCA").replace(/[\\/:*?"<>|]+/g, "").trim();
        a.download = nm + " - RCA Report.doc";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setStatus("Word document downloaded — diagrams (Fishbone, Pareto, 5-Why) and photos are embedded and will display in Word.", "ok");
    }

    // ================= real Word .docx (Office Open XML) =================
    // Builds a genuine .docx package in the browser: a ZIP (CRC-32 + raw
    // deflate via CompressionStream) holding WordprocessingML plus the
    // diagrams as PNG parts. No external library.
    const CRC_TABLE = (function () {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
        return t;
    })();
    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    async function deflateRaw(bytes) {
        const cs = new CompressionStream("deflate-raw");
        const stream = new Blob([bytes]).stream().pipeThrough(cs);
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    async function makeZip(files) {
        const enc = new TextEncoder();
        const chunks = [], central = [];
        let offset = 0;
        for (const f of files) {
            const nameBytes = enc.encode(f.name);
            const crc = crc32(f.data);
            let method = 8, comp;
            try { comp = await deflateRaw(f.data); } catch (e) { comp = f.data; method = 0; }
            if (method === 8 && comp.length >= f.data.length) { comp = f.data; method = 0; }
            const lh = new Uint8Array(30 + nameBytes.length);
            const dv = new DataView(lh.buffer);
            dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0, true);
            dv.setUint16(8, method, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true);
            dv.setUint32(14, crc, true); dv.setUint32(18, comp.length, true); dv.setUint32(22, f.data.length, true);
            dv.setUint16(26, nameBytes.length, true); dv.setUint16(28, 0, true);
            lh.set(nameBytes, 30);
            chunks.push(lh, comp);
            const cd = new Uint8Array(46 + nameBytes.length);
            const cv = new DataView(cd.buffer);
            cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
            cv.setUint16(8, 0, true); cv.setUint16(10, method, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
            cv.setUint32(16, crc, true); cv.setUint32(20, comp.length, true); cv.setUint32(24, f.data.length, true);
            cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
            cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true);
            cv.setUint32(42, offset, true);
            cd.set(nameBytes, 46);
            central.push(cd);
            offset += lh.length + comp.length;
        }
        let cdSize = 0; central.forEach((c) => { cdSize += c.length; });
        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
        ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
        ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
        return new Blob(chunks.concat(central, [eocd]), { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    }
    function dataUrlToBytes(u) {
        const bin = atob(String(u).slice(String(u).indexOf(",") + 1));
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    const xE = (s) => String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    async function downloadDocx(saveHandle) {
        if (reportBox.hidden) { setStatus("Generate the RCA report first.", "err"); return; }
        setStatus("Building the Word (.docx) document…");
        const blob = await buildRcaDocx();
        await deliverFile(saveHandle, blob, rcaWordName(), "Word .docx", false);
    }

    // Builds the real .docx and returns it. Download (Word) saves it; the Word
    // preview draws it - the same bytes either way.
    async function buildRcaDocx() {

        let imgs = [];
        try { imgs = await allDiagramImages(); } catch (e) { imgs = []; }

        const media = [];                  // {name, bytes, rid, wEmu, hEmu}
        // A4 (11906 tw) minus the 1354-tw side margins = the exact text width.
        // Every box is built to this width in twips (percentages drift in Word and
        // made the tables stick out past the heading rules). The page border sits
        // WORD_FRAME_GAP_PT (11 pt = 220 tw) outside the text, so it lands on the
        // 20 mm (1134 tw) line - the same place as the PDF's frame - with the same
        // ~4 mm of white between the frame and the tables.
        const TEXT_W = 11906 - 2 * 1354;          // 9198
        // Every line in the file: 0.75 pt (sz 6) - the same weight as the PDF's
        // 1 px lines. 0.5 pt lines faded or vanished in Word at normal zoom.
        const LINE_SZ = 6;
        const CONTENT_EMU = Math.round(TEXT_W / 1440 * 914400);   // same width, in EMU
        // maxWEmu / maxHEmu cap the picture. Without a HEIGHT cap a squarish photo
        // (e.g. 500x500) blown up to the full text width becomes a huge block that
        // eats half the page - the wide fishbone is fine at full width, a photo is not.
        function addImage(dataUrl, natW, natH, maxWEmu, maxHEmu) {
            const rid = "rId" + (100 + media.length);
            const name = "image" + (media.length + 1) + ".png";
            const ratio = (natH || 1) / (natW || 1);
            let w = Math.min(CONTENT_EMU, maxWEmu || CONTENT_EMU);
            let h = Math.round(w * ratio);
            if (maxHEmu && h > maxHEmu) { h = maxHEmu; w = Math.round(h / ratio); }
            media.push({ name: name, bytes: dataUrlToBytes(dataUrl), rid: rid, wEmu: w, hEmu: h });
            return media[media.length - 1];
        }
        let picId = 1;
        // keepNext: the picture has a caption under it - keep the two on one page
        // (the fishbone's caption used to start the next page on its own).
        function drawingXml(m, keepNext) {
            const id = picId++;
            return '<w:p><w:pPr>' + (keepNext ? "<w:keepNext/>" : "") + '<w:spacing w:before="40" w:after="40"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>' +
                '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
                '<wp:extent cx="' + m.wEmu + '" cy="' + m.hEmu + '"/>' +
                '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
                '<wp:docPr id="' + id + '" name="Picture ' + id + '"/>' +
                '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
                '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
                '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
                '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
                '<pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + m.name + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
                '<pic:blipFill><a:blip r:embed="' + m.rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
                '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + m.wEmu + '" cy="' + m.hEmu + '"/></a:xfrm>' +
                '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
                '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
        }
        // element text -> one or more <w:p>
        function paras(text, opts) {
            const o = opts || {};
            const lines = String(text || "").split(/\n/);
            const rPr = "<w:rPr>" + (o.bold ? "<w:b/>" : "") + (o.sz ? '<w:sz w:val="' + o.sz + '"/>' : "") + "</w:rPr>";
            // CT_PPrBase order: pStyle, keepNext, ..., spacing, ..., jc.
            const pPr = "<w:pPr>" + (o.style ? '<w:pStyle w:val="' + o.style + '"/>' : "") +
                (o.style || o.keep ? "<w:keepNext/>" : "") +
                '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after || 0) + '"/>' +
                (o.center ? '<w:jc w:val="center"/>' : "") + "</w:pPr>";
            const out = lines.map((ln) => "<w:p>" + pPr + "<w:r>" + rPr + '<w:t xml:space="preserve">' + xE(ln) + "</w:t></w:r></w:p>");
            return out.length ? out.join("") : "<w:p>" + pPr + "</w:p>";
        }
        // cell content: keep <br>/<p>/<li> as separate lines
        function cellText(el) {
            let h = el.innerHTML || "";
            h = h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr)>/gi, "\n").replace(/<li[^>]*>/gi, "• ");
            const d = document.createElement("div"); d.innerHTML = h;
            return (d.textContent || "").replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        }
        // noTop: the block above already drew a horizontal rule, so this table skips
        // its own top border (otherwise the two sit together and read as one dark line).
        function tableXml(tbl, noTop) {
            const rows = Array.prototype.slice.call(tbl.rows);
            if (!rows.length) return "";
            const realCells = (r) => Array.prototype.slice.call(r.cells)
                .filter((c) => !(c.classList && c.classList.contains("rca-x")));
            let maxCols = 0;
            rows.forEach((r) => {
                let n = 0; realCells(r).forEach((c) => { n += (c.colSpan || 1); });
                if (n > maxCols) maxCols = n;
            });
            if (!maxCols) return "";
            // Content-aware column widths. The on-screen table is table-layout:fixed
            // (every column equal), which squeezes long text columns like "Action
            // description" and "Standardization" — so size them by what they hold.
            const cols = (function () {
                if (maxCols === 1) return [100];
                const len = new Array(maxCols).fill(0);
                rows.forEach((r) => {
                    let i = 0;
                    realCells(r).forEach((c) => {
                        const span = c.colSpan || 1;
                        const n = (c.textContent || "").trim().length / span;
                        for (let k = 0; k < span && i < maxCols; k++, i++) if (n > len[i]) len[i] = n;
                    });
                });
                const wt = len.map((n) => Math.min(Math.max(n, 6), 50));
                // A short first column is a label column -> keep it at 22% so the data
                // in every table still starts at the same gap.
                if (len[0] <= 25) {
                    let rest = 0;
                    for (let i = 1; i < maxCols; i++) rest += wt[i];
                    const o = new Array(maxCols);
                    o[0] = 22;
                    for (let i = 1; i < maxCols; i++) o[i] = rest ? (78 * wt[i]) / rest : 78 / (maxCols - 1);
                    return o;
                }
                let total = 0; wt.forEach((x) => { total += x; });
                return wt.map((x) => (x * 100) / total);
            })();
            // Exact per-column twips. A short header word ("Status", "Qty"…) still
            // needs real width to not wrap — 300 tw was only ~0.2in, too little for
            // even a 6-letter word at this font size, which is what wrapped "Status"
            // into "Statu"/"s". Give every column a proper minimum, then shrink
            // whichever column is widest (normally the one long free-text column) to
            // absorb the difference, so the row still lands on exactly TEXT_W.
            // The floor must never make the row wider than the text area, or the
            // table prints wider than its neighbours and the boxes stop lining up -
            // which is what made the widths look ragged. Cap the floor by what
            // actually fits, then take any overflow off the columns that have slack
            // (proportionally), and put the last twip on the widest column so the
            // row lands on EXACTLY TEXT_W every time.
            const MIN_COL = Math.min(850, Math.floor(TEXT_W / maxCols));
            // Every column at least as wide as the longest WORD in its header, so a
            // heading never breaks mid-word ("Analysi" / "s"): ~115 tw per bold
            // 9.5 pt character plus the two cell margins. Capped at twice an even
            // share, so one long heading cannot squeeze the rest of the row.
            const wordMin = new Array(maxCols).fill(0);
            (function () {
                let i = 0;
                (rows[0] ? realCells(rows[0]) : []).forEach((c) => {
                    const span = c.colSpan || 1;
                    const longest = String(c.textContent || "").trim().split(/\s+/)
                        .reduce((m, w) => Math.max(m, w.length), 0);
                    if (span === 1 && i < maxCols) wordMin[i] = longest * 115 + 2 * 108 + 40;
                    i += span;
                });
            })();
            const minFor = (i) => Math.min(Math.floor((TEXT_W / maxCols) * 2), Math.max(MIN_COL, wordMin[i] || 0));
            let dxa = cols.map((c, i) => Math.max(minFor(i), Math.round((c * TEXT_W) / 100)));
            const total = (a) => a.reduce((s, w) => s + w, 0);

            let sum = total(dxa);
            if (sum > TEXT_W) {
                const excess = sum - TEXT_W;
                const slack = dxa.reduce((s, w, i) => s + Math.max(0, w - minFor(i)), 0);
                if (slack > 0) {
                    dxa = dxa.map((w, i) => {
                        const s = Math.max(0, w - minFor(i));
                        return w - Math.round((excess * s) / slack);
                    });
                }
            }
            // exact remainder (either direction) onto the widest column
            sum = total(dxa);
            if (sum !== TEXT_W) {
                let widest = 0;
                for (let i = 1; i < maxCols; i++) if (dxa[i] > dxa[widest]) widest = i;
                dxa[widest] += (TEXT_W - sum);
            }
            const bd = (t) => '<w:' + t + ' w:val="single" w:sz="' + LINE_SZ + '" w:space="0" w:color="000000"/>';
            const noBd = (t) => '<w:' + t + ' w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
            // The boxes draw their OWN sides now (no page border), so the frame stops
            // where the content stops instead of two bare vertical lines running down
            // the empty part of the last page.
            // NOTE: CT_TblPrBase requires this element order: tblW, tblInd, tblBorders, tblLayout, tblCellMar.
            // tblInd 0 (with compatibilityMode 15 in settings.xml) puts the table's
            // outer line exactly on the text margin - where the heading rules start.
            let x = '<w:tbl><w:tblPr><w:tblW w:w="' + TEXT_W + '" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/>' +
                "<w:tblBorders>" + (noTop ? noBd("top") : bd("top")) + bd("left") + bd("bottom") + bd("right") + bd("insideH") + bd("insideV") + "</w:tblBorders>" +
                '<w:tblLayout w:type="fixed"/>' +
                // ~1.9 mm either side and ~1 mm above/below the text - the PDF's
                // cell padding. 80/40 tw let text run right up to the lines.
                '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar>' +
                "</w:tblPr><w:tblGrid>";
            for (let i = 0; i < maxCols; i++) x += '<w:gridCol w:w="' + dxa[i] + '"/>';
            x += "</w:tblGrid>";
            rows.forEach((r, ri) => {
                // cantSplit: a row moves to the next page whole, as in the PDF.
                // keepNext on every row but the last keeps a table that fits on a
                // page in one piece (Word moves it down whole, like the PDF does)
                // instead of leaving its header row alone at the foot of a page.
                const keep = ri < rows.length - 1;
                x += "<w:tr><w:trPr><w:cantSplit/></w:trPr>";
                let col = 0;
                realCells(r).forEach((c) => {
                    const span = c.colSpan || 1;
                    const isHead = c.tagName === "TH";
                    let width = 0;
                    for (let k = 0; k < span; k++) width += (dxa[col + k] || 0);
                    if (!width) width = Math.round(TEXT_W / maxCols);
                    col += span;
                    // Same light grey as the PDF's header cells.
                    const shade = isHead ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : "";
                    // Take the alignment straight from the on-screen table so Word
                    // matches it. Short columns (SL No, Qty, dates) are centred there;
                    // hard-coding data cells to the left made those numbers sit against
                    // the left border while their heading stayed centred.
                    let centred = isHead;
                    try { centred = isHead || (window.getComputedStyle(c).textAlign || "").toLowerCase() === "center"; }
                    catch (e) { /* keep the header-only default */ }
                    x += "<w:tc><w:tcPr>" + '<w:tcW w:w="' + width + '" w:type="dxa"/>' +
                        (span > 1 ? '<w:gridSpan w:val="' + span + '"/>' : "") + shade +
                        '<w:vAlign w:val="' + (isHead ? "center" : "top") + '"/></w:tcPr>' +
                        paras(cellText(c), { bold: isHead, center: centred, sz: 19, keep: keep }) + "</w:tc>";   // 9.5 pt, as in the PDF
                });
                x += "</w:tr>";
            });
            return x + "</w:tbl>";
        }
        // Section heading, laid out like the PDF: bold 15 pt numbered heading with
        // one thin rule under it, running margin to margin - the same width and
        // left edge as every table. The old four-sided box was indented and
        // "pushed back out" by its border spacing, which Word and viewers place
        // differently, so it never lined up with the tables. There is white space
        // between the rule and the table below it, so the two never form a double
        // line. keepNext (style RcaHeading) keeps it on the page of what follows.
        function sectionHeadXml(txt) {
            return '<w:p><w:pPr><w:pStyle w:val="RcaHeading"/><w:keepNext/>' +
                '<w:pBdr><w:bottom w:val="single" w:sz="' + LINE_SZ + '" w:space="1" w:color="000000"/></w:pBdr>' +
                // 11 pt above / 5 pt below: clearly separated, without the extra
                // height that pushed the last lines of a full report onto a page
                // of their own.
                '<w:spacing w:before="220" w:after="100"/></w:pPr>' +
                '<w:r><w:rPr><w:b/><w:sz w:val="30"/></w:rPr><w:t xml:space="preserve">' + xE(txt) + "</w:t></w:r></w:p>";
        }

        // ---- header block: logo | 8D Report | Rec./Rev./Issued ----
        // The logo keeps its own proportions. It is redrawn onto a canvas as a PNG
        // (so any image type the user picks works in Word) and scaled to fit its
        // cell. It used to be forced into a 3:1 box, which squashed a squarish
        // logo into a dark strip.
        const logo = rcaLogoData();
        let logoXml = "";
        if (logo && logo.indexOf("data:image") === 0) {
            try {
                // Panned / zoomed exactly as the "⤢ Adjust" box shows it on screen.
                const png = await rcaLogoBaked(150, 44);
                // at most ~3.3 cm wide (the logo cell) and ~1.3 cm tall (the three banner rows)
                if (png) logoXml = drawingXml(addImage(png.url, png.w, png.h, 1200000, 480000));
            } catch (e) { logoXml = ""; }
        }
        const val = (s) => (s && s.trim()) ? s.trim() : "";
        // The banner is ONE table - logo | title | label | value - three rows, the
        // logo and title cells spanning all three (vMerge). It used to hold the
        // Rec. No. box as a table nested inside a cell, which Word versions lay out
        // differently: the box lost its right-hand line and its bottom line sat on
        // the banner's rule as a double line. Now the box's cells and the rule are
        // drawn by the same table, so every edge is one line, and the box closes
        // exactly on the right margin like every other table.
        // Columns are derived from TEXT_W, so the row always sums to the text width.
        const BAN_L = Math.round(TEXT_W * 0.2371);          // logo
        const BAN_R = Math.round(TEXT_W * 0.2983);          // Rec. No. box
        const BAN_M = TEXT_W - BAN_L - BAN_R;               // title (absorbs rounding)
        const BAN_R1 = Math.round(BAN_R * 0.4768);          // label column
        const BAN_R2 = BAN_R - BAN_R1;                      // value column
        const nil = (t) => '<w:' + t + ' w:val="nil"/>';
        const one = (t) => '<w:' + t + ' w:val="single" w:sz="' + LINE_SZ + '" w:space="0" w:color="000000"/>';
        const tcW = (w) => '<w:tcW w:w="' + w + '" w:type="dxa"/>';
        // logo / title: no lines of their own except the rule under the banner
        const openBd = "<w:tcBorders>" + nil("top") + nil("left") + one("bottom") + nil("right") + "</w:tcBorders>";
        const boxBd = "<w:tcBorders>" + one("top") + one("left") + one("bottom") + one("right") + "</w:tcBorders>";
        const recRows = [["Rec. No.", val(fields.no.value)], ["Rev. No./Date", val(fields.rev.value) + (val(fields.issue.value) ? " / " + val(fields.issue.value) : "")], ["Issued Date", val(fields.issue.value)], ["Status", val(fields.status.value) || "Open"]];
        let body =
            '<w:tbl><w:tblPr><w:tblW w:w="' + TEXT_W + '" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/>' +
            "<w:tblBorders>" + nil("top") + nil("left") + nil("bottom") + nil("right") + nil("insideH") + nil("insideV") + "</w:tblBorders>" +
            '<w:tblLayout w:type="fixed"/>' +
            '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar>' +
            "</w:tblPr>" +
            '<w:tblGrid><w:gridCol w:w="' + BAN_L + '"/><w:gridCol w:w="' + BAN_M + '"/><w:gridCol w:w="' + BAN_R1 + '"/><w:gridCol w:w="' + BAN_R2 + '"/></w:tblGrid>' +
            recRows.map((p, i) => {
                const first = i === 0;
                const vm = first ? '<w:vMerge w:val="restart"/>' : "<w:vMerge/>";
                return "<w:tr><w:trPr><w:cantSplit/></w:trPr>" +
                    "<w:tc><w:tcPr>" + tcW(BAN_L) + vm + openBd + '<w:vAlign w:val="center"/></w:tcPr>' +
                        (first && logoXml ? logoXml : "<w:p/>") + "</w:tc>" +
                    "<w:tc><w:tcPr>" + tcW(BAN_M) + vm + openBd + '<w:vAlign w:val="center"/></w:tcPr>' +
                        (first ? '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>' +
                            '<w:r><w:rPr><w:b/><w:sz w:val="48"/></w:rPr><w:t>8D Report</w:t></w:r></w:p>' : "<w:p/>") + "</w:tc>" +
                    "<w:tc><w:tcPr>" + tcW(BAN_R1) + boxBd + '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:vAlign w:val="center"/></w:tcPr>' +
                        paras(p[0], { bold: true, sz: 17 }) + "</w:tc>" +
                    "<w:tc><w:tcPr>" + tcW(BAN_R2) + boxBd + '<w:vAlign w:val="center"/></w:tcPr>' +
                        paras(p[1], { sz: 17 }) + "</w:tc>" +
                    "</w:tr>";
            }).join("") +
            "</w:tbl>";

        // ---- walk each section in order ----
        const secs = reportBox.querySelectorAll(".rca-sec");
        // Tracks whether the block just emitted already ended with a horizontal rule,
        // so the next table can skip its top border instead of doubling the line.
        let ruleBelow = false;
        for (const sec of secs) {
            const h = sec.querySelector("h3");
            body += sectionHeadXml(h ? h.textContent : "");
            ruleBelow = false;          // white space follows the heading rule
            for (const child of Array.prototype.slice.call(sec.children)) {
                if (child.tagName === "H3") continue;
                if (child.classList && child.classList.contains("rca-fish")) {
                    const svg = child.querySelector("svg.fish-svg, svg.rca-diagram");
                    const tbl = child.querySelector("table");
                    const cap = child.querySelector(".rca-fish-cap");
                    if (svg) {
                        const hit = imgs.find((d) => d.el === svg);
                        if (hit) {
                            const vb = (svg.viewBox && svg.viewBox.baseVal) || { width: 1010, height: 392 };
                            // 92% of the text width: the diagram reads the same, and it
                            // leaves room for its caption on the same page.
                            body += drawingXml(addImage(hit.url, vb.width || 1010, vb.height || 392, Math.round(CONTENT_EMU * 0.92)), !!cap);
                            if (cap) body += paras(cap.textContent, { center: true, sz: 17 });
                        } else {
                            // Rasterisation failed - never drop the diagram silently.
                            body += paras("[Diagram could not be embedded — see the on-screen report]", { center: true });
                        }
                        ruleBelow = false;
                    } else if (tbl) {
                        body += tableXml(tbl, ruleBelow);
                        if (cap) { body += paras(cap.textContent, { center: true, sz: 17 }); ruleBelow = false; }
                        else ruleBelow = true;
                    } else {
                        // Every evidence photo, each capped so it stays a reasonable
                        // thumbnail (~7cm wide / 6cm tall) instead of a full-width block.
                        const PHOTO_W = 1620000, PHOTO_H = 1260000;   // EMU (~4.5cm x ~3.5cm)
                        const ims = Array.prototype.slice.call(child.querySelectorAll(".rca-evi img"))
                            .filter((im) => im.src && im.src.indexOf("data:image") === 0);
                        if (ims.length) {
                            ims.forEach((im) => {
                                body += drawingXml(addImage(im.src, im.naturalWidth || 800, im.naturalHeight || 600, PHOTO_W, PHOTO_H));
                            });
                            if (cap) body += paras(cap.textContent, { center: true, sz: 17 });
                            ruleBelow = false;
                        }
                    }
                } else if (child.tagName === "TABLE") {
                    body += tableXml(child, ruleBelow);
                    ruleBelow = true;
                } else if (child.classList && child.classList.contains("rca-8d-subh")) {
                    body += paras(child.textContent, { bold: true, sz: 24, style: "RcaSubHeading", before: 200, after: 80 });
                    ruleBelow = false;
                } else if (child.classList && (child.classList.contains("rca-8d-area") || child.classList.contains("rca-body") || child.classList.contains("rca-8d-team"))) {
                    // The team line is the last text: keep it on the page of the
                    // closing line so that line never sits alone on a new page.
                    body += paras(cellText(child), { keep: child.classList.contains("rca-8d-team") });
                    ruleBelow = false;
                }
            }
        }
        // ---- doc-control footer line ----
        // Bottom border closes the frame at the very end of the document - the one
        // place, symmetric with the opening top border, where a line is drawn purely
        // to complete the frame rather than because content needs it there.
        const footerBd = '<w:bottom w:val="single" w:sz="' + LINE_SZ + '" w:space="4" w:color="000000"/>';
        // No empty paragraph in front of it (that extra line alone could push the
        // closing line onto a page of its own); a little space above instead.
        body += "<w:p><w:pPr><w:pBdr>" + footerBd + "</w:pBdr>" +
            '<w:spacing w:before="120" w:after="0"/><w:jc w:val="center"/></w:pPr>' +
            '<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">' +
            xE("Rec. No.: " + (val(fields.no.value) || "—") +
                "    Rev: " + (val(fields.rev.value) || "00") +
                "    8D Report — Confidential    Issued: " + (val(fields.issue.value) || new Date().toLocaleDateString())) +
            "</w:t></w:r></w:p>";

        // ---- section properties: A4, margins, page frame ----
        // Same geometry as the PDF: the frame is one thin line on the 20 mm margin
        // at the top and sides and 22 mm at the bottom, on every page; the text
        // starts WORD_FRAME_GAP_PT (~4 mm) inside it. The frame is measured FROM
        // THE TEXT, so it follows the margins exactly: 1354 tw - 220 tw = 1134 tw
        // (20 mm), bottom 1467 - 220 = 1247 tw (22 mm). The gap means no table
        // line ever lands on the frame, so there is never a double line.
        // CT_SectPr order: pgSz, pgMar, paperSrc, pgBorders, ...
        // CT_SectPr order: headerReference, footerReference, pgSz, pgMar, paperSrc, pgBorders.
        // header 680 tw = 12 mm and footer 794 tw = 14 mm from the page edge put the
        // running header above the frame and the footer below it, as in the PDF.
        const pgB = (t) => '<w:' + t + ' w:val="single" w:sz="' + LINE_SZ + '" w:space="' + WORD_FRAME_GAP_PT + '" w:color="000000"/>';
        body += '<w:sectPr><w:headerReference w:type="default" r:id="rId3"/><w:footerReference w:type="default" r:id="rId4"/>' +
            '<w:pgSz w:w="11906" w:h="16838"/>' +
            '<w:pgMar w:top="1354" w:right="1354" w:bottom="1467" w:left="1354" w:header="680" w:footer="794" w:gutter="0"/>' +
            '<w:pgBorders w:offsetFrom="text">' +
                pgB("top") + pgB("left") + pgB("bottom") + pgB("right") +
            "</w:pgBorders>" +
            "</w:sectPr>";

        // ---- running header and footer, the same as the PDF's ----
        // Above the frame: BNC MOTORS | ROOT CAUSE ANALYSIS | Doc / Rev.
        // Below it: Doc  Rev | BNC Motors — Confidential | Page x of y.
        // Indented out by the frame gap so they start and end on the frame's
        // edges; settings.xml stops the page border from wrapping round them.
        const GAP_TW = WORD_FRAME_GAP_PT * 20;
        const hfDoc = val(fields.no.value) || "RCA", hfRev = val(fields.rev.value) || "00";
        const hfRun = (t, bold) => "<w:r><w:rPr>" + (bold ? "<w:b/>" : "") + '<w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">' + xE(t) + "</w:t></w:r>";
        const hfTab = "<w:r><w:tab/></w:r>";
        const hfField = (instr) => '<w:fldSimple w:instr=" ' + instr + ' "><w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>';
        const hfPara = (runs) => "<w:p><w:pPr><w:tabs>" +
            '<w:tab w:val="center" w:pos="' + Math.round(TEXT_W / 2) + '"/><w:tab w:val="right" w:pos="' + (TEXT_W + GAP_TW) + '"/>' +
            '</w:tabs><w:spacing w:before="0" w:after="0"/><w:ind w:left="-' + GAP_TW + '" w:right="-' + GAP_TW + '"/></w:pPr>' + runs + "</w:p>";
        const hfNs = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
        const headerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + hfNs + ">" +
            hfPara(hfRun("BNC MOTORS", true) + hfTab + hfRun("ROOT CAUSE ANALYSIS", true) + hfTab + hfRun("Doc " + hfDoc + " / Rev " + hfRev)) +
            "</w:hdr>";
        const footerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + hfNs + ">" +
            hfPara(hfRun("Doc " + hfDoc + "  Rev " + hfRev) + hfTab + hfRun("BNC Motors — Confidential") + hfTab +
                hfRun("Page ") + hfField("PAGE") + hfRun(" of ") + hfField("NUMPAGES")) +
            "</w:ftr>";

        const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
            'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
            "<w:body>" + body + "</w:body></w:document>";

        const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            "<w:docDefaults><w:rPrDefault><w:rPr>" +
            '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="21"/><w:szCs w:val="21"/>' +
            "</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>" +
            '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
            // Headings keep with the block after them, so a heading is never left
            // alone at the foot of a page.
            '<w:style w:type="paragraph" w:customStyle="1" w:styleId="RcaHeading"><w:name w:val="RCA Heading"/>' +
            '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/></w:pPr>' +
            '<w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>' +
            '<w:style w:type="paragraph" w:customStyle="1" w:styleId="RcaSubHeading"><w:name w:val="RCA Sub Heading"/>' +
            '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/></w:pPr>' +
            '<w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>' +
            "</w:styles>";

        // Word 2013+ layout (compatibilityMode 15). Without settings.xml Word opens
        // the file in compatibility mode, where a table's outer line hangs out past
        // the margin by the cell padding and no longer lines up with the headings.
        const settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            // the page border goes round the text only, not the running header/footer
            "<w:bordersDoNotSurroundHeader/><w:bordersDoNotSurroundFooter/>" +
            '<w:defaultTabStop w:val="720"/><w:compat>' +
            '<w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>' +
            "</w:compat></w:settings>";

        const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Default Extension="png" ContentType="image/png"/>' +
            '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
            '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
            '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
            '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
            "</Types>";

        const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
            "</Relationships>";

        const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
            '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
            media.map((m) => '<Relationship Id="' + m.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.name + '"/>').join("") +
            "</Relationships>";

        const enc = new TextEncoder();
        const files = [
            { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
            { name: "_rels/.rels", data: enc.encode(rootRels) },
            { name: "word/document.xml", data: enc.encode(documentXml) },
            { name: "word/styles.xml", data: enc.encode(stylesXml) },
            { name: "word/settings.xml", data: enc.encode(settingsXml) },
            { name: "word/header1.xml", data: enc.encode(headerXml) },
            { name: "word/footer1.xml", data: enc.encode(footerXml) },
            { name: "word/_rels/document.xml.rels", data: enc.encode(docRels) }
        ];
        media.forEach((m) => files.push({ name: "word/media/" + m.name, data: m.bytes }));

        return await makeZip(files);
    }

    // Prefer the true .docx; fall back to the MHTML .doc if anything fails.
    async function downloadWord() {
        if (reportBox.hidden) { setStatus("Generate the RCA report first.", "err"); return; }
        if (rcaGenerating) { setStatus("Please wait - the RCA report is still being generated.", "err"); return; }
        // While the PDF renders, its diagrams are temporarily swapped for pictures
        // in the page, so a Word file built now found NO diagrams and wrote
        // "[Diagram could not be embedded]" in place of the fishbone and 5-Why.
        if (rcaPdfBusy) { setStatus("The PDF is still being built - download the Word file as soon as it finishes.", "err"); return; }
        // Ask WHERE to save first, while this still counts as the user's click.
        const handle = await pickSave(rcaWordName(), DOCX_MIME, ".docx");
        if (handle === "cancel") { setStatus("Save cancelled."); return; }
        try { await downloadDocx(handle); }
        catch (e) {
            setStatus("Falling back to the .doc format (" + (e && e.message ? e.message : e) + ")…");
            try { await download(); } catch (e2) { setStatus("Could not build the Word file: " + e2.message, "err"); }
        }
    }

    // ---------- export the whole report as a PDF ----------
    // ---------- PDF: one build, then either save it or preview it ----------
    // Export PDF and Preview PDF run the SAME build, so the preview shows exactly
    // the file that gets saved.
    let rcaPdfBusy = false;

    function rcaPdfReady() {
        if (reportBox.hidden) { setStatus("Generate the RCA report first.", "err"); return null; }
        if (typeof html2pdf === "undefined") { setStatus("PDF library not loaded.", "err"); return null; }
        const doc = reportBox.querySelector(".rca-doc");
        if (!doc) { setStatus("Nothing to export.", "err"); return null; }
        return doc;
    }

    function rcaPdfName() {
        return (fields.no.value.trim() || fields.product.value.trim() || "RCA").replace(/[\\/:*?"<>|]+/g, "").trim() +
            " - RCA Report.pdf";
    }

    const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    function rcaWordName() {
        return (fields.product.value.trim() || "RCA").replace(/[\\/:*?"<>|]+/g, "").trim() + " - RCA Report.docx";
    }

    async function exportRcaPdf() {
        // A second click while one runs did nothing at all, with no message.
        if (rcaPdfBusy) { setStatus("A PDF is already being built - it will be ready in a moment.", ""); return; }
        if (rcaGenerating) { setStatus("Please wait - the RCA report is still being generated.", "err"); return; }
        if (!rcaPdfReady()) return;
        const filename = rcaPdfName();
        // Ask WHERE to save up front, while this still counts as the user's click -
        // the render takes seconds, by which time that permission has lapsed.
        const saveHandle = await pickSave(filename, "application/pdf", ".pdf");
        if (saveHandle === "cancel") { setStatus("Export cancelled."); return; }
        rcaPdfBusy = true;
        setStatus("Building the PDF…");
        try {
            const pdfObj = await buildRcaPdf();
            await deliverFile(saveHandle, pdfObj.output("blob"), filename, "PDF", true);
        } catch (e) {
            setStatus("Could not export the PDF: " + e.message, "err");
        } finally {
            rcaPdfBusy = false;
        }
    }

    // Preview with a PDF tab and a Word tab. Each tab runs the same build as its
    // download button and draws the real file - PDF pages through pdf.js, the
    // .docx as Word pages - in white document pages, not the app's theme. Each
    // Save button uses exactly the same pickSave + deliverFile as the download.
    function previewRca() {
        if (reportBox.hidden) { setStatus("Generate the RCA report first.", "err"); return; }
        if (rcaPdfBusy) { setStatus("A PDF export is still running — try again in a moment.", "err"); return; }
        if (rcaGenerating) { setStatus("Please wait - the RCA report is still being generated.", "err"); return; }
        const pdfName = rcaPdfName(), wordName = rcaWordName();
        const cancelled = () => { const stop = new Error("cancelled"); stop.name = "AbortError"; return stop; };
        openTabbedPreview([
            {
                key: "pdf", tab: "📄 PDF", what: "PDF", filename: pdfName, saveText: "💾 Save PDF",
                build: async () => {
                    if (rcaPdfBusy) throw new Error("a PDF export is still running");
                    if (!rcaPdfReady()) throw new Error("the report is not ready");
                    rcaPdfBusy = true;
                    try { return (await buildRcaPdf()).output("blob"); }
                    finally { rcaPdfBusy = false; }
                },
                draw: renderPdfPages,
                save: async (blob) => {
                    const handle = await pickSave(pdfName, "application/pdf", ".pdf");
                    if (handle === "cancel") throw cancelled();
                    await deliverFile(handle, blob, pdfName, "PDF", true);
                }
            },
            {
                key: "docx", tab: "📝 Word", what: "Word file", filename: wordName, saveText: "💾 Save Word",
                build: () => buildRcaDocx(),
                draw: renderDocxPages,
                save: async (blob) => {
                    const handle = await pickSave(wordName, DOCX_MIME, ".docx");
                    if (handle === "cancel") throw cancelled();
                    await deliverFile(handle, blob, wordName, "Word .docx", false);
                }
            }
        ], "pdf");
        setStatus("Preview open — switch between 📄 PDF and 📝 Word, then save the one you want.", "ok");
    }

    // The PDF render itself. Returns the finished jsPDF document and always puts
    // the on-screen report back the way it was, whether it succeeds or not.
    async function buildRcaPdf() {
        const doc = reportBox.querySelector(".rca-doc");
        if (!doc) throw new Error("nothing to export");
        const docNo = fields.no.value.trim() || "RCA";
        const rev = fields.rev.value.trim() || "00";

        // The on-screen zoom must not reach the PDF: the page-break pass below
        // measures with getBoundingClientRect(), which a CSS scale falsifies,
        // so every break would land in the wrong place. `.exporting` drops the
        // transform for the whole render and the finally puts it back.
        reportBox.classList.add("exporting");

        // Swap each live SVG diagram for its PNG in place (html2canvas can render
        // inline SVG blank). The report stays attached & laid out, so the capture
        // is reliable; the SVGs are restored afterwards.
        let imgs = [];
        try { imgs = await allDiagramImages(); } catch (e) { imgs = []; }
        const swaps = [];   // {img, svg} to restore
        imgs.forEach((hit) => {
            const svg = hit.el;
            if (!svg.parentNode) return;
            const im = document.createElement("img");
            im.src = hit.url; im.className = "rca-pdf-img";
            im.style.cssText = "width:100%;max-width:660px;display:block;margin:0 auto;";
            svg.parentNode.replaceChild(im, svg);
            swaps.push({ img: im, svg: svg });
        });
        // Hide the add-row buttons AND the whole on-screen "×" column for the PDF.
        const addrows = Array.prototype.slice.call(doc.querySelectorAll(".rca-addrow, .rca-rev-x, .rca-fe, .rca-x"));
        addrows.forEach((b) => { b.style.display = "none"; });
        doc.classList.add("rca-pdf");   // formal (bordered, TNR) look for the PDF

        // The diagram PNGs swapped in above have NO height until they load, so any
        // measurement taken now would see a much shorter document - which is exactly
        // why the page-break pass below found nothing to do and the tables were still
        // being sliced. Wait for them, then let the layout settle.
        await Promise.all(swaps.map((s) => new Promise((res) => {
            const im = s.img;
            if (im.complete && im.naturalHeight) { res(); return; }
            im.addEventListener("load", res, { once: true });
            im.addEventListener("error", res, { once: true });
            setTimeout(res, 4000);          // never hang on a broken image
        })));
        // A timer, NOT requestAnimationFrame: rAF is throttled (or never fires) when
        // the page is in a background tab or offscreen, which hangs the export.
        await new Promise((r) => setTimeout(r, 80));

        // ---- keep tables and text whole across page breaks -------------------
        // html2pdf's own avoid list does nothing useful here: it breaks by PUSHING
        // an element down, and a <tr> cannot be pushed (rows ignore margins), while
        // its block selectors had no measurable effect either. Blocks CAN be moved,
        // so do it directly: if a block would straddle a page boundary, insert a
        // spacer that fills the rest of that page so the block starts on the next
        // one. html2pdf slices one tall canvas at fixed page heights, so filling the
        // remainder of a page IS a page break.
        //
        // Page height: A4 297 - 24 top - 26 bottom = 247 mm of content (inside the
        // frame drawn on the 20/22 mm margins), and the report is locked to 612 px
        // for its 162 mm content width, so 247 mm = 933 px here.
        const pageBreaks = [];
        try {
            const PAGE_H = Math.floor((247 / 25.4) * 96);        // 933 px
            for (let guard = 0; guard < 60; guard++) {
                const top0 = doc.getBoundingClientRect().top;
                const blocks = Array.prototype.slice.call(
                    doc.querySelectorAll(".rca-sec > *, .rca-8d-head"));
                let inserted = false;
                for (const el of blocks) {
                    if (el.hasAttribute("data-pdf-spacer")) continue;
                    const r = el.getBoundingClientRect();
                    if (r.height <= 1) continue;
                    if (r.height > PAGE_H) continue;             // taller than a page
                    const top = r.top - top0;
                    if (Math.floor(top / PAGE_H) === Math.floor((r.bottom - top0 - 1) / PAGE_H)) continue;
                    // Never strand a heading at the foot of a page: if the block
                    // above is this block's heading, move the pair together.
                    let anchor = el;
                    const prev = el.previousElementSibling;
                    if (prev && !prev.hasAttribute("data-pdf-spacer") &&
                        (prev.classList.contains("rca-8d-h") || prev.classList.contains("rca-8d-subh"))) {
                        anchor = prev;
                    }
                    // Insert a spacer and GROW it until the block has really moved
                    // onto the next page. Computing the gap once and trusting it
                    // does not work: margin collapsing swallows a small spacer, so
                    // the block stays put, still straddles, and the loop just keeps
                    // adding more spacers in the same place (it inserted 60 of 1px
                    // each and never converged). Measuring after each step is the
                    // only reliable way.
                    const br = document.createElement("div");
                    br.setAttribute("data-pdf-spacer", "1");
                    br.style.cssText = "height:1px;margin:0;padding:0;border:0;";
                    anchor.parentNode.insertBefore(br, anchor);

                    let h = 1, moved = false;
                    while (h <= PAGE_H) {
                        const rr = el.getBoundingClientRect();
                        const t = rr.top - doc.getBoundingClientRect().top;
                        if (Math.floor(t / PAGE_H) === Math.floor((t + rr.height - 1) / PAGE_H)) {
                            moved = true; break;                 // it fits on one page now
                        }
                        h += 8;
                        br.style.height = h + "px";
                    }
                    if (!moved) { br.parentNode.removeChild(br); continue; }   // can't help
                    pageBreaks.push(br);
                    inserted = true;
                    break;                                       // re-measure each time
                }
                if (!inserted) break;
            }
        } catch (e) { /* an unbroken export is still better than none */ }

        try {
            // Guard against html2canvas stalling: without this the promise can hang
            // forever, the "finally" never runs, the report is left stuck in PDF
            // styling and the user gets NO feedback at all - it just looks like the
            // button does nothing. Time out instead so the UI always recovers.
            let pdfObj = null;
            const pdfRun = html2pdf().set({
                // Content margins, mm [top, right, bottom, left]. The page frame is
                // drawn on the 20 mm margin (22 mm at the bottom) below, and the
                // content starts 4 mm inside it, so no table line ever lands on the
                // frame. 24 mm sides give a 162 mm content width, which is what the
                // .rca-pdf stylesheet is built around: the report is locked to
                // 612 px, so 162 mm / 612 px = 0.75 pt per CSS pixel and every font
                // size in that stylesheet lands on its intended point size.
                // Change one without the other and the type size drifts.
                margin: [24, 24, 26, 24],
                filename: rcaPdfName(),
                // Measured on the real export, same report each time:
                //     png  scale 2 -> 29.2 MB      jpeg q1.00 scale 3 -> 2.4 MB
                //     png  scale 3 -> 65.6 MB      jpeg q0.92 scale 2 -> 0.9 MB
                // PNG is lossless but unusable at 30-65 MB. JPEG at quality 1.0 with
                // the 3x canvas is the right point: a 1px rule is 3 canvas pixels
                // before downscaling, so the compression ringing that made lines look
                // doubled at q0.96/scale 2 is no longer visible, and the file is 2.4 MB.
                image: { type: "jpeg", quality: 1 },
                // scale 3 (was 2): the canvas is downscaled to fit A4, and at 2x a
                // hairline landed between output pixels and got resampled into two
                // grey rows. 3x keeps the rules solid and sharpens the text.
                html2canvas: { scale: 3, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                // Page breaks must land BETWEEN blocks, never through a table row or
                // a line of text. Two things matter here:
                //   * "tr" is useless - html2pdf breaks by PUSHING an element down,
                //     and a table row cannot be pushed (rows ignore margins).
                //   * the selectors must be BLOCK level, which can be pushed.
                // html2pdf measures inside its own render clone, so letting it decide
                // is more reliable than computing boundaries against the live DOM
                // (those two do not agree - measured).
                pagebreak: {
                    mode: ["css", "legacy"],
                    avoid: [".rca-sec > table", ".rca-sec > div", ".rca-sec > h3",
                            ".rca-fish", ".rca-evi figure", ".rca-8d-head"]
                }
            }).from(doc).toPdf().get("pdf").then((pdf) => {
                pdfObj = pdf;
                const total = pdf.internal.getNumberOfPages();
                const w = pdf.internal.pageSize.getWidth();
                const h = pdf.internal.pageSize.getHeight();
                for (let i = 1; i <= total; i++) {
                    pdf.setPage(i);
                    // ---- page frame: one thin line on the margins, every page ----
                    // Drawn per page as a vector line, so every page has all four
                    // sides (the old frame was the report's own outline, cut up
                    // between pages, so pages lost their top or bottom edge). It
                    // is 0.26 mm - the same weight as a 1 px table line - and the
                    // content sits 4 mm inside it, so it never doubles a table line.
                    pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.26);
                    pdf.rect(20, 20, w - 40, h - 42);

                    // ---- running header above the frame: company | title | doc no. / rev ----
                    // Text only - a rule here would run parallel to the frame
                    // just below it and read as a double line.
                    pdf.setFont("times", "bold");
                    pdf.setFontSize(8.5); pdf.setTextColor(0, 0, 0);
                    pdf.text("BNC MOTORS", 20, 16);
                    pdf.text("ROOT CAUSE ANALYSIS", w / 2, 16, { align: "center" });
                    pdf.setFont("times", "normal");
                    pdf.text("Doc " + docNo + " / Rev " + rev, w - 20, 16, { align: "right" });

                    // ---- footer below the frame: doc control | confidentiality | page x of y ----
                    pdf.setFontSize(8.5); pdf.setTextColor(0, 0, 0);
                    pdf.text("Doc " + docNo + "  Rev " + rev, 20, h - 16);
                    pdf.text("BNC Motors — Confidential", w / 2, h - 16, { align: "center" });
                    pdf.text("Page " + i + " of " + total, w - 20, h - 16, { align: "right" });
                }
            });
            let timer;
            const guard = new Promise((_, rej) => {
                timer = setTimeout(() => rej(new Error("timed out while rendering (the report may be very large)")), 120000);
            });
            try { await Promise.race([pdfRun, guard]); } finally { clearTimeout(timer); }
            if (!pdfObj) throw new Error("the PDF engine returned no document");
            return pdfObj;
        } finally {
            // restore the live SVG diagrams, the add-row buttons and the modern look
            swaps.forEach((s) => { if (s.img.parentNode) s.img.parentNode.replaceChild(s.svg, s.img); });
            addrows.forEach((b) => { b.style.display = ""; });
            // take the page-break markers back out - they are only for the export
            pageBreaks.forEach((b) => { if (b.parentNode) b.parentNode.removeChild(b); });
            doc.classList.remove("rca-pdf");
            reportBox.classList.remove("exporting");   // the screen zoom comes back
        }
    }

    // ---------- evidence photo upload ----------
    const addPhotoBtn = document.getElementById("rcaAddPhoto");
    const photoInput = document.getElementById("rcaPhotoFile");
    if (addPhotoBtn && photoInput) {
        addPhotoBtn.addEventListener("click", () => photoInput.click());
        photoInput.addEventListener("change", () => {
            const files = Array.prototype.slice.call(photoInput.files || []);
            photoInput.value = "";
            // Count the free places up front: the files are read in parallel, so
            // checking inside each read let several photos slip past the limit.
            let room = 6 - photos.length;
            files.forEach((f) => {
                if (f.size > 4 * 1024 * 1024) { setStatus("Skipped " + f.name + " — larger than 4 MB.", "err"); return; }
                if (room <= 0) { setStatus("Maximum 6 evidence photos — " + f.name + " was not added.", "err"); return; }
                room--;
                const r = new FileReader();
                r.onload = () => {
                    if (photos.length >= 6) { setStatus("Maximum 6 evidence photos.", "err"); return; }
                    // Kept at a print-sharp size, not the phone original (up to 4 MB):
                    // the report HTML embeds the photo, and a full-size copy there
                    // made Save RCA fail with "storage full" after one photo.
                    const add = (url) => {
                        if (photos.length >= 6) { setStatus("Maximum 6 evidence photos.", "err"); return; }
                        photos.push(url); renderPhotoTray(); save(); refreshEvidencePhotos();
                        setStatus(photos.length + " evidence photo(s) attached — they appear in section 2 (Problem Description).", "ok");
                    };
                    if (typeof shrinkImage === "function") shrinkImage(r.result, 1600, 0.85).then(add, () => add(r.result));
                    else add(r.result);
                };
                r.readAsDataURL(f);
            });
        });
    }

    // Rasterise an inline SVG to a PNG data URL (crisp 2x). Returns a Promise.
    function svgDataUrl(svgEl) {
        return new Promise((resolve) => {
            const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
            const w = (vb && vb.width) ? vb.width : (svgEl.clientWidth || 1080);
            const h = (vb && vb.height) ? vb.height : (svgEl.clientHeight || 560);
            const xml = new XMLSerializer().serializeToString(svgEl);
            const img = new Image();
            img.onload = function () {
                const c = document.createElement("canvas");
                c.width = w * 2; c.height = h * 2;
                const ctx = c.getContext("2d");
                ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                try { resolve({ url: c.toDataURL("image/png"), w: w, h: h }); }
                catch (e) { resolve(null); }
            };
            img.onerror = function () { resolve(null); };
            img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
        });
    }

    // Every diagram in the report as {el, url, w, h}, in document order.
    async function allDiagramImages() {
        const svgs = Array.prototype.slice.call(reportBox.querySelectorAll("svg.fish-svg, svg.rca-diagram"));
        const out = [];
        for (let i = 0; i < svgs.length; i++) {
            const d = await svgDataUrl(svgs[i]);
            if (d) out.push({ el: svgs[i], url: d.url, w: d.w, h: d.h });
        }
        return out;
    }

    // ---------- download EVERY diagram as a PNG (to paste into Word) ----------
    function svgToPng(svgEl, name, done) {
        const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
        const w = (vb && vb.width) ? vb.width : 1080;
        const h = (vb && vb.height) ? vb.height : 560;
        const xml = new XMLSerializer().serializeToString(svgEl);
        const img = new Image();
        img.onload = function () {
            const c = document.createElement("canvas");
            c.width = w * 2.5; c.height = h * 2.5;           // 2.5x for a crisp picture
            const ctx = c.getContext("2d");
            ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(function (blob) {
                if (!blob) { if (done) done("err"); return; }
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = name + ".png";
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(a.href), 2000);
                if (done) done();
            }, "image/png");
        };
        img.onerror = function () { if (done) done("err"); };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    }

    function downloadDiagram() {
        const svgs = reportBox.querySelectorAll("svg.fish-svg, svg.rca-diagram");
        if (!svgs.length) { setStatus("Generate the RCA report first.", "err"); return; }
        const nm = (fields.product.value.trim() || "RCA").replace(/[\\/:*?"<>|]+/g, "").trim();
        const names = { "fish-svg": "Fishbone", "why-svg": "5-Why", "pareto-svg": "Pareto" };
        let i = 0, failed = 0;
        (function next() {
            if (i >= svgs.length) {
                // Report what really happened - it used to say "Saved" even when a
                // diagram could not be turned into a picture.
                const okCount = svgs.length - failed;
                if (!okCount) setStatus("Could not make the diagram picture — try Export PDF or Download (Word) instead.", "err");
                else setStatus("Saved " + okCount + " diagram(s) as PNG — paste them into the Word report." +
                    (failed ? " " + failed + " could not be made." : ""), failed ? "" : "ok");
                return;
            }
            const el = svgs[i++];
            let label = "Diagram-" + i;
            Object.keys(names).forEach((k) => { if (el.classList.contains(k)) label = names[k]; });
            // stagger the downloads so the browser does not block them
            svgToPng(el, nm + " - " + label, (err) => { if (err) failed++; setTimeout(next, 350); });
        })();
    }

    // ---------- ready-made samples, so the page can be tried in one click ----------
    const SAMPLES = [
        {
            no: "RCA-2026-014", rev: "00", issue: "17/07/2026", status: "Under investigation",
            product: "BLDC hub motor 48V 1000W", partNo: "BM-4512", date: "12/07/2026",
            model: "HM-48-1000", flash: "FR-2026-051",
            qty: "12 of 500 (Lot A23)", where: "End-of-line test", by: "R. Kumar",
            approver: "P. Menon (Plant Quality Manager)", verifier: "A. Raj (BNC Quality)",
            cust: "Assembly Line 2",
            team: "R. Kumar (Quality), S. Devi (Production), A. Raj (Design), M. Iqbal (Supplier)",
            problem: "Motor stops after about 10 minutes of running at rated load, with a burnt smell from the stator winding. " +
                "12 units out of 500 in lot A23 failed at end-of-line test on Line 2 on 12/07/2026. Winding resistance is open on one phase. " +
                "Lot A22 and Line 1 are not affected. No failures at no-load or cold start."
        },
        {
            no: "RCA-2026-015", rev: "00", issue: "17/07/2026", status: "Open",
            product: "48V 30Ah lithium battery pack", partNo: "BP-2210", date: "09/07/2026",
            qty: "7 of 60 (Lot B11)", where: "Cycle-life qualification", by: "S. Devi",
            cust: "Internal qualification lab",
            team: "S. Devi (Quality), K. Menon (Cell supplier), P. Nair (BMS), L. Roy (Test lab)",
            problem: "Battery pack shows 18% capacity loss after only 200 charge/discharge cycles against a 2000-cycle specification. " +
                "7 of 60 packs from lot B11 are affected, found during cycle-life qualification. Cell group 3 runs 8 °C hotter than the other groups. " +
                "Packs from lot B10 are not affected."
        },
        {
            no: "RCA-2026-016", rev: "00", issue: "17/07/2026", status: "Actions implemented",
            product: "Double-sided acrylic mounting tape 25mm", partNo: "TP-0925", date: "05/07/2026",
            qty: "9 of 40 (Lot T7)", where: "Customer / field", by: "A. Raj",
            cust: "Customer X — vehicle build",
            team: "A. Raj (Quality), N. Bose (Process), T. Shah (Tape supplier)",
            problem: "Double-sided mounting tape peels off the battery bracket after 3 days in the vehicle. " +
                "9 of 40 units from lot T7 are affected, reported by the customer. The failure happens only on powder-coated brackets, " +
                "not on bare aluminium. Peel adhesion measures 6 N/25mm against a 12 N/25mm specification."
        }
    ];
    // A complete worked RCA for sample 1, written in the same format the AI returns,
    // so "Load sample" fills the whole report AND every diagram instantly, offline.
    SAMPLES[0].report = [
"1. Problem Description",
"Motor stops after about 10 minutes at rated load with a burnt smell from the stator winding. 12 of 500 units from lot A23 failed at end-of-line test on Line 2 on 12/07/2026. One phase reads open circuit.",
"What: Stator winding burn-out, one phase open | Rotor, magnet or bearing failure",
"Where: Lot A23 on Line 2 | Lot A22 and Line 1",
"When: After ~10 min at rated load | At no-load or cold start",
"Extent: 12 of 500 units (2.4%) | The whole lot",
"Who: End-of-line test operator | Customer or field",
"",
"2. Containment / Immediate Action",
"- Quarantined the balance of lot A23 (488 units) in stores and 120 units in transit.",
"- 100% Hi-Pot and winding-resistance test applied to all lot A23 stock before despatch.",
"- Boundary lots identified: A22 verified OK, A24 placed on hold.",
"- Containment completed and verified by S. Devi on 12/07/2026.",
"",
"3. Evidence & Investigation",
"- All 12 failed units stripped: the burn is at the phase-U coil crossover in every unit.",
"- Winding machine tension log shows a step change on 11/07/2026 at 14:00 on Line 2.",
"- 4M check: the winding tensioner was replaced on 11/07/2026 without a set-up approval.",
"- Good vs failed comparison: failed insulation shows abrasion marks at the crossover.",
"Pareto: Winding insulation burn=34; Bearing noise=18; Connector loose=11; Magnet crack=6; Housing burr=3",
"",
"4. Failure Analysis (failure mode)",
"Cross-section shows the enamel insulation abraded through at the phase-U crossover, giving a turn-to-turn short. The short raises local current and overheats the coil, burning the winding after about 10 minutes at rated load. Failure mode = turn-to-turn insulation breakdown caused by mechanical abrasion during winding.",
"",
"5. Possible Causes — Fishbone (6M)",
"Man: Set-up done without approval (Confirmed); Operator not re-trained on new tensioner (Confirmed)",
"Machine: Tensioner replaced, tension too high (Confirmed); Worn wire guide roller (Ruled-out)",
"Material: Enamel wire lot within spec (Ruled-out); Enamel thickness at low limit (Confirmed)",
"Method: No tension value in work instruction (Confirmed); No first-off approval after change (Confirmed)",
"Measurement: No in-process HV test (Confirmed); Tension gauge not calibrated (Confirmed)",
"Environment: Humidity within limits (Ruled-out); Dust in winding area (Ruled-out)",
"",
"6. Root Cause Analysis — 5-Why",
"Occurrence: Winding burns after 10 min -> Turn-to-turn short in phase U -> Enamel abraded at crossover -> Winding tension too high -> Tensioner set without approved value -> No set-up approval for tensioner change",
"Detection: Defect escaped to end-of-line -> No in-process insulation test -> HV test not in control plan -> Control plan not reviewed after machine change -> 4M change not linked to control plan",
"Systemic: Machine changed without review -> PFMEA not revisited -> 4M change control not enforced -> No gate requiring PFMEA review on 4M change",
"",
"7. Root Cause (occurrence / detection / systemic)",
"- Occurrence: the winding tensioner was replaced and set without an approved tension value, so the enamel abraded at the coil crossover.",
"- Detection: there is no in-process HV / insulation test in the control plan, so the defect reached end-of-line.",
"- Systemic: the 4M change-control process does not require a PFMEA and control-plan review before restarting production.",
"",
"8. Corrective Action",
"- Set and lock the winding tension to 2.4 ± 0.2 N and add it to the work instruction (Owner: Production Engineer, 2 weeks).",
"- Add a first-off approval and tension verification after any tensioner change (Owner: Quality Engineer, 2 weeks).",
"- Add an in-process HV test at 1500 V AC after winding, with automatic reject (Owner: Process Engineer, 4 weeks).",
"- Calibrate the tension gauge and add it to the calibration plan (Owner: Metrology, 1 week).",
"",
"9. Preventive Action & Horizontal Deployment",
"- Update the PFMEA and control plan for all BLDC winding lines (Owner: Quality, 4 weeks).",
"- Add a 4M change gate: no restart without PFMEA / control-plan review and first-off approval (Owner: Plant Quality Manager, 6 weeks).",
"- Deploy the tension lock and in-process HV test to Line 1 and the Chennai plant (Owner: Manufacturing Engineering, 8 weeks).",
"- Add the tensioner setting to the preventive-maintenance checklist (Owner: Maintenance, 3 weeks).",
"",
"10. Verification of Effectiveness",
"- 100% HV test over the next 3 lots (1500 units): 0 insulation rejects against a target of 0.",
"- Winding tension recorded within 2.4 ± 0.2 N on 100% of set-ups for 30 days.",
"- End-of-line burn-out rate: 2.4% before the action, 0% over the next 30 days / 1500 units.",
"- Effectiveness confirmed by Quality at the end of the 3-lot / 30-day window.",
"",
"11. Conclusion",
"The burn-out was caused by excessive winding tension after an unapproved tensioner change, which abraded the enamel and created a turn-to-turn short. It escaped because no in-process insulation test existed. The tension is now locked and verified, an in-process HV test rejects the defect at source, and a 4M change gate prevents recurrence. Verified over 3 lots with 0 defects; the report is recommended for closure."
    ].join("\n");

    const sampleBtn = document.getElementById("rcaSample");
    if (sampleBtn) sampleBtn.addEventListener("click", () => {
        if (rcaBusy()) return;
        if (!reportBox.hidden && reportBox.querySelector(".rca-body") &&
            !confirm("Load the sample RCA?\n\nThis replaces the report on screen. Save it first (Save RCA) if you need it.")) return;
        const s = SAMPLES[0];
        Object.keys(s).forEach((k) => { if (fields[k]) fields[k].value = s[k]; });
        const made = buildFromText(s.report);
        save();
        setStatus("Sample RCA loaded (" + s.product + ") with " + (made || []).join(", ") +
            " — a complete worked example. Every section and table is editable; try Export PDF / Diagram (PNG).", "ok");
    });

    genBtn.addEventListener("click", generate);
    dlBtn.addEventListener("click", downloadWord);

    // "View / Print": open the report in a new window laid out EXACTLY like the
    // Export PDF file - the formal document style (Times New Roman, thin black
    // single lines, numbered headings, no cards or shadows) cut into real A4
    // pages, each with the frame on the 20 mm margin (22 mm at the bottom), the
    // content 4 mm inside it, the running header above the frame and "Page x of
    // y" below it. Each page is a fixed A4 box, so 🖨 Print / Save as PDF puts
    // one on each sheet of paper: what is on screen is what prints. (It used to
    // print the on-screen cards - rounded boxes, grey headings, no border.)
    function previewReport() {
        if (reportBox.hidden) { setStatus("Generate the RCA report first.", "err"); return; }
        const src = reportBox.querySelector(".rca-doc");
        if (!src) { setStatus("Nothing to preview.", "err"); return; }
        const clone = src.cloneNode(true);
        // Remove all on-screen editing controls for a clean document view.
        clone.querySelectorAll(".rca-x, .rca-rev-x, .rca-fe, .rca-addrow, button, [data-pdf-spacer], .rca-logo-ph").forEach((el) => el.remove());
        clone.querySelectorAll("[title]").forEach((el) => el.removeAttribute("title"));
        clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
        clone.classList.add("rca-pdf");                  // the formal document stylesheet (612 px = 162 mm wide)
        const cssHref = (document.querySelector('link[rel="stylesheet"]') || {}).href || "";
        const opts = {
            docNo: fields.no.value.trim() || "RCA",
            rev: fields.rev.value.trim() || "00"
        };
        const title = ("8D Report — " + (fields.no.value.trim() || fields.product.value.trim() || "RCA"))
            .replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const font = "'Times New Roman',Times,serif";
        const w = window.open("", "_blank");
        if (!w) { setStatus("Pop-up blocked — allow pop-ups for this page to use View / Print.", "err"); return; }
        w.document.open();
        w.document.write(
            "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
            "<title>" + title + "</title>" +
            (cssHref ? "<link rel='stylesheet' href='" + cssHref + "'>" : "") +
            "<style>" +
            // Every page is drawn as an exact A4 box, so the printer margin is 0.
            "@page{size:A4;margin:0;}" +
            "html,body{margin:0;padding:0;}" +
            // Plain grey desk like a PDF viewer - the app's own coloured page
            // background (and its ::before glow layer) must not show here.
            "html,body{background:#525659!important;background-image:none!important;}" +
            "body::before,body::after{content:none!important;display:none!important;}" +
            "body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
            ".prev-bar{position:sticky;top:0;z-index:5;background:#0F4C81;color:#fff;padding:8px 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-family:" + font + ";}" +
            ".prev-bar b{flex:1;min-width:0;}" +
            ".prev-count{font-weight:400;opacity:.9;}" +
            ".prev-bar button{padding:6px 14px;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:" + font + ";}" +
            ".prev-bar button:disabled{opacity:.55;cursor:progress;}" +
            ".prev-print{background:#047857;color:#fff;} .prev-close{background:#e2e8f0;color:#0f172a;}" +
            // The report before it is cut into pages (kept out of sight).
            ".prev-src{position:absolute;left:-10000px;top:0;visibility:hidden;}" +
            ".sheets{padding:18px 0 1px;}" +
            // One A4 page - same geometry as Export PDF: frame at 20 mm (22 mm at
            // the bottom), content box 24 mm in, 162 mm x 247 mm.
            ".sheet{position:relative;box-sizing:border-box;width:210mm;height:297mm;margin:0 auto 18px;background:#fff;color:#000;" +
                "box-shadow:0 2px 12px rgba(0,0,0,.5);overflow:hidden;font-family:" + font + ";}" +
            ".sheet-frame{position:absolute;left:20mm;top:20mm;right:20mm;bottom:22mm;border:.26mm solid #000;}" +
            ".sheet-head,.sheet-foot{position:absolute;left:20mm;right:20mm;display:flex;font-size:8.5pt;line-height:1;white-space:nowrap;}" +
            ".sheet-head{top:13mm;} .sheet-foot{top:278.5mm;}" +
            ".sheet-head > *,.sheet-foot > *{flex:1;} .sheet-head > :nth-child(2),.sheet-foot > :nth-child(2){text-align:center;}" +
            ".sheet-head > :last-child,.sheet-foot > :last-child{text-align:right;}" +
            ".sheet-body{position:absolute;left:24mm;top:24mm;width:162mm;height:247mm;overflow:hidden;}" +
            // no gap above the first block on a page
            ".sheet-body > .rca-doc > :first-child,.sheet-body > .rca-doc > .rca-sec:first-child > :first-child{margin-top:0!important;}" +
            "@media print{" +
                "html,body{background:#fff!important;}" +
                ".prev-bar{display:none!important;}" +
                ".sheets{padding:0;zoom:1!important;}" +
                // a hair under 297 mm so rounding can never spill a blank page
                ".sheet{margin:0;box-shadow:none;height:296.8mm;break-after:page;page-break-after:always;}" +
                ".sheet:last-child{break-after:auto;page-break-after:auto;}" +
            "}" +
            "</style></head><body>" +
            "<div class='prev-bar'><b>8D Report — A4 preview <span class='prev-count'></span></b>" +
            "<button class='prev-print' onclick='window.print()' disabled>🖨 Print / Save as PDF</button>" +
            "<button class='prev-close' onclick='window.close()'>Close</button></div>" +
            "<div class='sheets'></div>" +
            "<div class='prev-src'>" + clone.outerHTML + "</div>" +
            "<script>(" + rcaPrintPaginate.toString() + ")(" + JSON.stringify(opts).replace(/</g, "\\u003c") + ");</" + "script>" +
            "</body></html>");
        w.document.close();
        setStatus("Opened the A4 preview — the same pages as Export PDF. Use 🖨 Print / Save as PDF there.", "ok");
    }

    // Runs INSIDE the View / Print window (passed over as source text, so it must
    // not use anything from this file). Cuts the report into A4 pages like the
    // Export PDF: blocks move to the next page whole, a heading goes along with
    // the block under it, and only a table or text block taller than a whole
    // page is split - between rows or paragraphs, never through one, with the
    // table's header row repeated on the next page.
    function rcaPrintPaginate(o) {
        const run = () => {
            const src = document.querySelector(".prev-src > .rca-doc");
            const sheets = document.querySelector(".sheets");
            if (!src || !sheets) return;
            const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
            const isHeading = (el) => !!el && !!el.classList &&
                (el.classList.contains("rca-8d-h") || el.classList.contains("rca-8d-subh"));

            let cur = null;
            const newSheet = () => {
                const sh = document.createElement("section");
                sh.className = "sheet";
                sh.innerHTML = "<div class='sheet-frame'></div>" +
                    "<div class='sheet-head'><b>BNC MOTORS</b><b>ROOT CAUSE ANALYSIS</b><span>Doc " + esc(o.docNo) + " / Rev " + esc(o.rev) + "</span></div>" +
                    "<div class='sheet-body'></div>" +
                    "<div class='sheet-foot'><span>Doc " + esc(o.docNo) + "&nbsp;&nbsp;Rev " + esc(o.rev) + "</span><span>BNC Motors — Confidential</span><span class='sheet-no'></span></div>";
                sheets.appendChild(sh);
                const body = sh.querySelector(".sheet-body");
                const doc = src.cloneNode(false);
                body.appendChild(doc);
                cur = { body: body, doc: doc, sec: null, secSrc: null };
            };
            const fits = () => cur.doc.offsetHeight <= cur.body.clientHeight + 1;
            const blocks = () => cur.doc.querySelectorAll(":scope > :not(.rca-sec), :scope > .rca-sec > *").length;
            const host = (secSrc) => {
                if (!secSrc) return cur.doc;
                if (cur.secSrc !== secSrc) {
                    cur.sec = secSrc.cloneNode(false);
                    cur.doc.appendChild(cur.sec);
                    cur.secSrc = secSrc;
                }
                return cur.sec;
            };
            const tidy = () => {
                if (cur.sec && !cur.sec.children.length) { cur.sec.remove(); cur.sec = null; cur.secSrc = null; }
            };

            // Split el (a table, or a block of paragraphs) at the page end: as many
            // rows / children as fit stay here, the rest stays in el for the next
            // page. Returns how many were placed here.
            const split = (el, parent, force) => {
                const part = el.cloneNode(false);
                let from, to, hdr = null;
                if (el.tagName === "TABLE") {
                    if (el.tHead) part.appendChild(el.tHead.cloneNode(true));
                    from = el.tBodies[0] || el;
                    to = from === el ? part : part.appendChild(from.cloneNode(false));
                    const first = from.rows[0];
                    if (!el.tHead && first && Array.prototype.every.call(first.cells, (c) => c.tagName === "TH")) {
                        hdr = first;
                        to.appendChild(hdr.cloneNode(true));
                    }
                } else {
                    // Lines typed without paragraphs (bare text and <br>) are one
                    // piece that cannot be split - and they were lost when a long
                    // block was split. Give every such line its own element first.
                    const loose = Array.prototype.some.call(el.childNodes, (n) =>
                        (n.nodeType === 3 && n.textContent.trim()) || (n.nodeType === 1 && n.tagName === "BR"));
                    if (loose) {
                        const nodes = Array.prototype.slice.call(el.childNodes);
                        el.innerHTML = "";
                        let line = document.createElement("div");
                        const flush = () => {
                            if (!line.textContent.trim() && !line.querySelector("img")) line.innerHTML = "&nbsp;";
                            el.appendChild(line);
                            line = document.createElement("div");
                        };
                        nodes.forEach((n) => {
                            if (n.nodeType === 1 && /^(P|DIV|UL|OL|TABLE|H[1-6]|FIGURE|BLOCKQUOTE|PRE)$/.test(n.tagName)) {
                                if (line.childNodes.length && line.textContent.trim()) flush();
                                else line = document.createElement("div");
                                el.appendChild(n);
                            } else if (n.nodeType === 1 && n.tagName === "BR") {
                                flush();
                            } else {
                                line.appendChild(n);
                            }
                        });
                        if (line.textContent.trim()) flush();
                    }
                    from = el;
                    to = part;
                }
                const items = Array.prototype.filter.call(from.children, (c) => c !== hdr && c.tagName !== "COLGROUP");
                if (items.length < 2 && !force) return 0;
                parent.replaceChild(part, el);
                let placed = 0;
                for (const it of items) {
                    to.appendChild(it);
                    if (fits() || (force && placed === 0)) { placed++; continue; }
                    from.insertBefore(it, hdr ? hdr.nextSibling : from.firstChild);
                    break;
                }
                if (!placed) parent.replaceChild(el, part);
                return placed;
            };

            const queue = [];
            Array.prototype.forEach.call(src.children, (el) => {
                if (el.classList.contains("rca-sec")) {
                    Array.prototype.forEach.call(el.children, (c) => queue.push({ el: c, sec: el }));
                } else {
                    queue.push({ el: el, sec: null });
                }
            });

            newSheet();
            let guard = 0;
            while (queue.length && guard++ < 5000) {
                const it = queue.shift();
                const parent = host(it.sec);
                parent.appendChild(it.el);
                if (fits()) continue;

                const alone = blocks() === 1;
                const tooTall = it.el.offsetHeight > cur.body.clientHeight;
                if (tooTall || alone) {
                    const placed = split(it.el, parent, alone);
                    if (placed) {
                        const rest = it.el.tagName === "TABLE"
                            ? Array.prototype.filter.call((it.el.tBodies[0] || it.el).rows, (r) => !Array.prototype.every.call(r.cells, (c) => c.tagName === "TH")).length
                            : it.el.children.length;
                        if (rest) { newSheet(); queue.unshift(it); }
                        continue;
                    }
                    if (alone) continue;               // cannot be split: leave it on its own page
                }

                // Move the block to the next page, with a heading left above it.
                parent.removeChild(it.el);
                const carry = [it];
                while (parent !== cur.doc && isHeading(parent.lastElementChild) && blocks() > 1) {
                    carry.unshift({ el: parent.removeChild(parent.lastElementChild), sec: it.sec });
                }
                tidy();
                newSheet();
                queue.unshift.apply(queue, carry);
            }

            const all = sheets.querySelectorAll(".sheet");
            all.forEach((s, i) => { s.querySelector(".sheet-no").textContent = "Page " + (i + 1) + " of " + all.length; });
            document.querySelector(".prev-src").remove();
            const count = document.querySelector(".prev-count");
            if (count) count.textContent = "· " + all.length + (all.length === 1 ? " page" : " pages");
            const btn = document.querySelector(".prev-print");
            if (btn) btn.disabled = false;

            // Narrow screens: shrink the pages to fit (printing is always 1:1).
            const fit = () => {
                const z = Math.min(1, (window.innerWidth - 16) / (210 * 96 / 25.4));
                sheets.style.zoom = z < 1 ? String(z) : "";
            };
            fit();
            window.addEventListener("resize", fit);
            document.body.setAttribute("data-paginated", String(all.length));
        };
        // Wait for the stylesheet and the pictures: measuring before they are in
        // would cut the pages in the wrong places.
        if (document.readyState === "complete") run();
        else window.addEventListener("load", run);
    }
    const viewBtn = document.getElementById("rcaView");
    if (viewBtn) viewBtn.addEventListener("click", previewReport);

    const pngBtn = document.getElementById("rcaPng");
    if (pngBtn) pngBtn.addEventListener("click", downloadDiagram);
    const pdfBtn = document.getElementById("rcaPdf");
    if (pdfBtn) pdfBtn.addEventListener("click", exportRcaPdf);
    const pdfPreviewBtnRca = document.getElementById("rcaPreview");
    if (pdfPreviewBtnRca) pdfPreviewBtnRca.addEventListener("click", previewRca);

    // ---------- Supplier 8D evaluation — AI analysis ----------
    (function initSupplier8D() {
        const card = document.getElementById("sup8dCard");
        if (!card) return;
        const upBtn = document.getElementById("sup8dUpload");
        const fileIn = document.getElementById("sup8dFile");
        const analyzeBtn = document.getElementById("sup8dAnalyze");
        const copyBtn = document.getElementById("sup8dCopy");
        const clrBtn = document.getElementById("sup8dClear");
        const textIn = document.getElementById("sup8dText");
        const thumbs = document.getElementById("sup8dThumbs");
        const statusEl = document.getElementById("sup8dStatus");
        const resultEl = document.getElementById("sup8dResult");
        const kindEl = document.getElementById("sup8dKind") || document.createElement("span");
        let items = [];   // { kind:'image', url, name } OR { kind:'doc', name, text, label, size }

        // Result type: "auto" (summary; 8D reports evaluated), "summary", "eval".
        const modeInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="sup8dMode"]'));
        const currentMode = () => { const m = modeInputs.find((r) => r.checked); return m ? m.value : "auto"; };
        const syncModeUi = () => {
            const m = currentMode();
            if (!analyzeBtn.classList.contains("is-loading")) {
                analyzeBtn.textContent = m === "eval" ? "Evaluate 8D report" : "Analyse & summarise";
            }
            modeInputs.forEach((r) => { const lab = r.closest(".sum-mode"); if (lab) lab.classList.toggle("on", r.checked); });
        };
        try {
            const saved = localStorage.getItem("sup8dMode");
            const hit = modeInputs.find((r) => r.value === saved);
            if (hit) hit.checked = true;
        } catch (e) { /* default */ }
        modeInputs.forEach((r) => r.addEventListener("change", () => {
            try { localStorage.setItem("sup8dMode", currentMode()); } catch (e) { /* ignore */ }
            syncModeUi();
        }));
        syncModeUi();

        const stat = (msg, kind) => { statusEl.textContent = msg || ""; statusEl.className = "cases-status" + (kind ? " " + kind : ""); };
        const esc8 = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        // ONE busy state for the whole card. Reading files and evaluating each used
        // to switch the buttons on and off by themselves, so a file dropped during
        // an evaluation unlocked every button when its reading finished - Clear
        // then emptied the input and the old answer arrived for nothing on screen,
        // or Evaluate could be pressed again and two evaluations raced.
        let reading8d = 0, evaluating8d = false;
        function lock8d() {
            const busy = reading8d > 0 || evaluating8d;
            upBtn.disabled = busy; analyzeBtn.disabled = busy; clrBtn.disabled = busy;
            textIn.disabled = evaluating8d;
            modeInputs.forEach((r) => { r.disabled = evaluating8d; });
        }
        const refreshClear = () => {
            const something = !!(items.length || textIn.value.trim() || !resultEl.hidden);
            clrBtn.hidden = !something;
            // The "Nothing to evaluate yet" note was never hidden.
            const empty = document.getElementById("sup8dEmpty");
            if (empty) empty.hidden = something;
        };
        // A ZIP container: .docx, .xlsx, .pptx... A ZIP must never go through the
        // "readable bytes" scan - an Excel or PowerPoint file's internal part
        // names passed it and were sent to the AI as if they were the report.
        const isZipBuf = (buf) => {
            const h = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
            return h[0] === 0x50 && h[1] === 0x4b;
        };
        // A short type tag for a file chip ("PDF", "XLSX"...).
        const typeTag = (name) => {
            const m = String(name || "").match(/\.([a-z0-9]{2,5})$/i);
            return m ? m[1].toUpperCase() : "TEXT";
        };
        const sizeText = (n) => !n ? "" : n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB";
        function renderThumbs() {
            thumbs.innerHTML = items.map((it, i) =>
                it.kind === "image"
                    ? "<div class='sup8d-thumb' title='" + esc8(it.name || "Picture") + "'><img src='" + it.url + "' alt=''><button type='button' data-i='" + i + "' title='Remove' aria-label='Remove'>✕</button></div>"
                    : "<div class='sup8d-thumb sup8d-doc' title='" + esc8(it.name) + "'>" +
                      "<span class='sup8d-doc-ic' data-tag='" + esc8(typeTag(it.name)) + "'>" + esc8(typeTag(it.name)) + "</span>" +
                      "<span class='sup8d-doc-meta'><span class='sup8d-doc-nm'>" + esc8(it.name) + "</span>" +
                      "<small>" + esc8([it.label, sizeText(it.size)].filter(Boolean).join(" · ")) + "</small></span>" +
                      "<button type='button' data-i='" + i + "' title='Remove' aria-label='Remove'>✕</button></div>"
            ).join("");
            refreshClear();
        }
        thumbs.addEventListener("click", (e) => {
            const b = e.target.closest("button[data-i]");
            if (!b) return;
            // Not mid-evaluation: the answer must describe the files on screen.
            if (evaluating8d || reading8d > 0) return;
            items.splice(+b.getAttribute("data-i"), 1);
            renderThumbs();
        });

        // ---- read PDF / Word (.docx) to text, natively (no external library) ----
        async function inflate(bytes, raw) {
            const ds = new DecompressionStream(raw ? "deflate-raw" : "deflate");
            const stream = new Blob([bytes]).stream().pipeThrough(ds);
            return new Uint8Array(await new Response(stream).arrayBuffer());
        }
        // HTML markup -> readable text (keeps rows/cells apart so tables stay legible).
        function htmlToText(html) {
            let t = String(html || "");
            t = t.replace(/<!--[\s\S]*?-->/g, "");
            t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
            t = t.replace(/<\/(td|th)>/gi, "\t").replace(/<\/(tr|p|div|h[1-6]|li)>/gi, "\n");
            t = t.replace(/<br[^>]*>/gi, "\n").replace(/<[^>]+>/g, "");
            // Symbols keep their meaning ("85&deg;C &plusmn;2" used to become
            // "85 C  2"), and "&amp;lt;" is no longer decoded twice.
            t = decodeEntities(t).replace(/&[a-z]+;/gi, " ");
            return t.replace(/\t{2,}/g, "\t").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        }
        // ".doc" files that are really MHTML (Word's HTML package — what this app exports)
        // or plain HTML. Falls back to a best-effort scan for legacy binary .doc.
        function legacyDocToText(buf) {
            const bytes = new Uint8Array(buf);
            let raw = "";
            try { raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
            catch (e) { raw = new TextDecoder("latin1").decode(bytes); }
            // --- MHTML package: pull the text/html MIME part ---
            if (/Content-Type:\s*multipart\/related/i.test(raw)) {
                const bm = raw.match(/boundary="?([^"\r\n;]+)"?/i);
                if (bm) {
                    const parts = raw.split("--" + bm[1]);
                    for (const p of parts) {
                        if (!/Content-Type:\s*text\/html/i.test(p)) continue;
                        const sep = p.search(/\r?\n\r?\n/);
                        if (sep < 0) continue;
                        let bodyTxt = p.slice(sep).replace(/^\r?\n\r?\n/, "");
                        // The part's own character set (Word usually writes windows-1252);
                        // decoding everything as UTF-8 turned ’ and – into "�".
                        const csm = p.slice(0, sep).match(/charset="?([\w-]+)"?/i);
                        const partDecoder = (() => {
                            try { return new TextDecoder(csm ? csm[1] : "utf-8", { fatal: false }); }
                            catch (e) { return new TextDecoder("utf-8", { fatal: false }); }
                        })();
                        if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(p)) {
                            bodyTxt = bodyTxt.replace(/=\r?\n/g, "")
                                .replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
                            try { bodyTxt = partDecoder.decode(Uint8Array.from(bodyTxt, (c) => c.charCodeAt(0) & 255)); } catch (e) { /* keep */ }
                        } else if (/Content-Transfer-Encoding:\s*base64/i.test(p)) {
                            try { bodyTxt = partDecoder.decode(Uint8Array.from(atob(bodyTxt.replace(/\s/g, "")), (c) => c.charCodeAt(0))); } catch (e) { /* keep */ }
                        }
                        const out = htmlToText(bodyTxt);
                        if (out && out.length > 20) return out;
                    }
                }
            }
            // --- plain HTML saved as .doc ---
            if (/<html|<table|<body|<div|<p[\s>]/i.test(raw)) {
                const out = htmlToText(raw);
                if (out && out.length > 20) return out;
            }
            // --- legacy binary .doc (OLE): best-effort readable runs ---
            let s = "";
            for (let i = 0; i < bytes.length; i++) {
                const c = bytes[i];
                if (c >= 32 && c < 127) s += String.fromCharCode(c);
                else if (c === 13 || c === 10 || c === 9) s += "\n";
                else s += "\u0000";
            }
            const words = s.split(/\u0000+/).filter((x) => /[A-Za-z]{3,}/.test(x) && x.trim().length > 3);
            const out = words.join("\n").replace(/\n{3,}/g, "\n\n").trim();
            if (out.length > 40) return out;
            throw new Error("no readable text");
        }
        // ---- ZIP containers (Word, Excel, PowerPoint, OpenDocument) ----
        // Lists the entries from the central directory; read(name) inflates one.
        function zipOpen(buf) {
            const bytes = new Uint8Array(buf), dv = new DataView(buf);
            let eocd = -1;
            for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
                if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
            }
            if (eocd < 0) throw new Error("not a valid ZIP-based document");
            let off = dv.getUint32(eocd + 16, true); const count = dv.getUint16(eocd + 10, true);
            const entries = {};
            for (let n = 0; n < count; n++) {
                if (off + 46 > bytes.length || dv.getUint32(off, true) !== 0x02014b50) break;
                const method = dv.getUint16(off + 10, true);
                const compSize = dv.getUint32(off + 20, true);
                const nameLen = dv.getUint16(off + 28, true), extraLen = dv.getUint16(off + 30, true), commLen = dv.getUint16(off + 32, true);
                const lho = dv.getUint32(off + 42, true);
                const name = new TextDecoder().decode(bytes.slice(off + 46, off + 46 + nameLen)).replace(/\\/g, "/");
                entries[name] = { method: method, compSize: compSize, lho: lho };
                off += 46 + nameLen + extraLen + commLen;
            }
            const names = Object.keys(entries);
            if (!names.length) throw new Error("empty ZIP");
            return {
                names: names,
                has: (n) => !!entries[n],
                read: async (n) => {
                    const e = entries[n];
                    if (!e) return "";
                    const lNameLen = dv.getUint16(e.lho + 26, true), lExtra = dv.getUint16(e.lho + 28, true);
                    const start = e.lho + 30 + lNameLen + lExtra;
                    const data = bytes.slice(start, start + e.compSize);
                    const out = e.method === 0 ? data : await inflate(data, true);
                    return new TextDecoder().decode(out);
                }
            };
        }
        const numSort = (a, b) => (parseInt((a.match(/(\d+)\.xml$/) || [0, 0])[1], 10) - parseInt((b.match(/(\d+)\.xml$/) || [0, 0])[1], 10));
        const tidyText = (t) => decodeEntities(t).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

        async function docxToText(buf) {
            const z = zipOpen(buf);
            const xml = await z.read("word/document.xml");
            if (!xml) throw new Error("no document text found");
            // Tracked deletions and field codes (PAGE, HYPERLINK "…") are not part of
            // the visible text - leave them out. Table cells stay apart (tab / line).
            const t = xml.replace(/<w:delText[^>]*>[\s\S]*?<\/w:delText>/g, "")
                .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, "")
                .replace(/<w:tab[^>]*\/>/g, "\t").replace(/<\/w:tc>/g, "\t").replace(/<\/w:tr>/g, "\n")
                .replace(/<\/w:p>/g, "\n").replace(/<w:br[^>]*\/?>/g, "\n").replace(/<[^>]+>/g, "");
            return tidyText(t);
        }

        // Excel (.xlsx / .xlsm): every sheet as rows of tab-separated cells, with the
        // sheet name, so the AI can read the table (totals, trends, highs and lows).
        async function xlsxToText(z) {
            const shared = [];
            const ss = await z.read("xl/sharedStrings.xml");
            (ss.match(/<si>[\s\S]*?<\/si>/g) || []).forEach((si) => {
                shared.push(decodeEntities((si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map((x) => x.replace(/<[^>]+>/g, "")).join("")));
            });
            const wb = await z.read("xl/workbook.xml");
            const sheetNames = (wb.match(/<sheet\b[^>]*>/g) || []).map((s) => decodeEntities((s.match(/name="([^"]*)"/) || [0, ""])[1]));
            const sheets = z.names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(numSort);
            let out = "", total = 0;
            for (let si = 0; si < sheets.length && total < 60000; si++) {
                const xml = await z.read(sheets[si]);
                const rows = xml.match(/<row\b[\s\S]*?<\/row>/g) || [];
                const lines = [];
                for (const r of rows) {
                    const cells = (r.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).map((c) => {
                        const type = (c.match(/\bt="([^"]+)"/) || [0, ""])[1];
                        if (type === "inlineStr") return decodeEntities((c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [0, ""])[1]);
                        const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [0, ""])[1];
                        if (type === "s") return shared[parseInt(v, 10)] || "";
                        return decodeEntities(v);
                    });
                    const line = cells.join("\t").replace(/\t+$/, "");
                    if (line.trim()) lines.push(line);
                    if (lines.length >= 3000) break;
                }
                if (!lines.length) continue;
                const block = "Sheet: " + (sheetNames[si] || ("Sheet " + (si + 1))) + "\n" + lines.join("\n") + "\n\n";
                out += block; total += block.length;
            }
            if (!out.trim()) throw new Error("the workbook has no cell text");
            return out.trim();
        }

        // PowerPoint (.pptx): the text of every slide (and its speaker notes), in order.
        async function pptxToText(z) {
            const slides = z.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(numSort);
            let out = "";
            for (let i = 0; i < slides.length; i++) {
                const xml = await z.read(slides[i]);
                const paras = (xml.match(/<a:p>[\s\S]*?<\/a:p>/g) || []).map((p) =>
                    decodeEntities((p.match(/<a:t>[\s\S]*?<\/a:t>/g) || []).map((x) => x.replace(/<[^>]+>/g, "")).join(""))).filter((s) => s.trim());
                const notesName = "ppt/notesSlides/notesSlide" + (slides[i].match(/(\d+)\.xml$/) || [0, ""])[1] + ".xml";
                let notes = "";
                if (z.has(notesName)) {
                    const nx = await z.read(notesName);
                    notes = decodeEntities((nx.match(/<a:t>[\s\S]*?<\/a:t>/g) || []).map((x) => x.replace(/<[^>]+>/g, "")).join(" ")).trim();
                }
                if (paras.length || notes) out += "Slide " + (i + 1) + ":\n" + paras.join("\n") + (notes ? "\nNotes: " + notes : "") + "\n\n";
            }
            if (!out.trim()) throw new Error("the presentation has no text");
            return out.trim();
        }

        // OpenDocument (.odt / .ods / .odp): content.xml, paragraphs and table cells kept apart.
        async function odfToText(z) {
            const xml = await z.read("content.xml");
            const t = xml.replace(/<text:tab\/>/g, "\t").replace(/<text:line-break\/>/g, "\n")
                .replace(/<\/table:table-cell>/g, "\t").replace(/<\/table:table-row>/g, "\n")
                .replace(/<\/text:(p|h)>/g, "\n").replace(/<[^>]+>/g, "");
            const out = tidyText(t);
            if (!out) throw new Error("no text");
            return out;
        }

        // Any ZIP-based office file: decide by what is inside, not by its name.
        async function officeToText(buf) {
            const z = zipOpen(buf);
            if (z.has("word/document.xml")) return { text: await docxToText(buf), kind: "Word document" };
            if (z.has("xl/workbook.xml")) return { text: await xlsxToText(z), kind: "Excel workbook" };
            if (z.has("ppt/presentation.xml")) return { text: await pptxToText(z), kind: "PowerPoint presentation" };
            if (z.has("content.xml")) return { text: await odfToText(z), kind: "OpenDocument file" };
            throw new Error("unsupported ZIP content");
        }

        // RTF: drop the control words and groups, keep the words.
        function rtfToText(raw) {
            let t = String(raw || "");
            t = t.replace(/\{\\\*[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "")                 // {\*\destination ...}
                .replace(/\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*\}/g, "")
                .replace(/\\par[d]?\b ?/g, "\n").replace(/\\line\b ?/g, "\n").replace(/\\tab\b ?/g, "\t").replace(/\\cell\b ?/g, "\t").replace(/\\row\b ?/g, "\n")
                .replace(/\\'([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
                .replace(/\\u(-?\d+)\??/g, (m, n) => String.fromCharCode((+n + 65536) % 65536))
                .replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/\\([{}\\])/g, "$1").replace(/[{}]/g, "");
            return t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        }

        // Old binary Office files (.xls / .ppt / .doc): best effort - the readable
        // text runs, both 8-bit and UTF-16 (Excel keeps its cell text as UTF-16).
        function binaryOfficeText(buf) {
            const bytes = new Uint8Array(buf);
            const runs = [];
            let cur = "";
            for (let i = 0; i + 1 < bytes.length; i += 2) {          // UTF-16LE runs
                const c = bytes[i] | (bytes[i + 1] << 8);
                if ((c >= 32 && c < 0xD800 && c !== 0xFFFF) || c === 9) cur += String.fromCharCode(c);
                else { if (cur.length >= 4) runs.push(cur); cur = ""; }
            }
            if (cur.length >= 4) runs.push(cur);
            // Pairs of ordinary 8-bit bytes also decode as "letters" (CJK soup), so a
            // run must be mostly Latin text to count.
            const utf16 = runs.filter((r) => /\p{L}{3,}/u.test(r) &&
                (r.match(/[	 -ɏ]/g) || []).length / r.length >= 0.9);
            let text = utf16.join("\n");
            if (!looksLikeProse(text)) { try { text = legacyDocToText(buf); } catch (e) { text = ""; } }
            return text;
        }
        // PDF text through pdf.js - the library that already draws the PDF previews
        // (vendor/pdfjs). It understands the fonts real PDFs use; the hand-written
        // reader below does not, so a PDF made by Microsoft Word or printed from a
        // browser came out empty and the evaluation had nothing to read. The old
        // reader is kept only for when pdf.js cannot be loaded.
        async function pdfJsText(buf) {
            const lib = await loadPdfJs();
            const doc = await lib.getDocument(pdfSafeOpts(new Uint8Array(buf.slice(0)))).promise;
            try {
                let out = "";
                const pages = Math.min(doc.numPages, 60);
                for (let p = 1; p <= pages; p++) {
                    const page = await doc.getPage(p);
                    const tc = await page.getTextContent();
                    let line = "", lastY = null, lastEnd = null;
                    tc.items.forEach((it) => {
                        if (typeof it.str !== "string") return;
                        const tr = it.transform || [1, 0, 0, 10, 0, 0];
                        const x = tr[4], y = Math.round(tr[5]);
                        const h = Math.abs(tr[3]) || 10;
                        if (lastY !== null && Math.abs(y - lastY) > h * 0.5) {
                            out += line.replace(/\s+$/, "") + "\n"; line = ""; lastEnd = null;
                        } else if (lastEnd !== null && x - lastEnd > h * 0.15 && line && !/\s$/.test(line) && !/^\s/.test(it.str)) {
                            line += " ";          // a visible gap between two pieces is a space
                        }
                        line += it.str;
                        lastY = y;
                        lastEnd = x + (it.width || 0);
                        if (it.hasEOL) { out += line.replace(/\s+$/, "") + "\n"; line = ""; lastEnd = null; }
                    });
                    out += line.replace(/\s+$/, "") + "\n\n";
                    page.cleanup();
                }
                return out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
            } finally { doc.destroy(); }
        }

        // The pages of a PDF that has no text (a scan) drawn as pictures, so the
        // vision model can read them.
        async function pdfJsPageImages(buf, maxPages) {
            const lib = await loadPdfJs();
            const doc = await lib.getDocument(pdfSafeOpts(new Uint8Array(buf.slice(0)))).promise;
            try {
                const out = [];
                out.total = doc.numPages;                 // so the user can be told if pages were left out
                const n = Math.min(doc.numPages, maxPages || 6);
                for (let p = 1; p <= n; p++) {
                    const page = await doc.getPage(p);
                    const base = page.getViewport({ scale: 1 });
                    const vp = page.getViewport({ scale: Math.min(2, 1100 / base.width) });
                    const c = document.createElement("canvas");
                    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
                    const ctx = c.getContext("2d");
                    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
                    await page.render({ canvasContext: ctx, viewport: vp }).promise;
                    out.push(c.toDataURL("image/jpeg", 0.85));
                    page.cleanup();
                }
                return out;
            } finally { doc.destroy(); }
        }

        async function pdfToText(buf) {
            const bytes = new Uint8Array(buf);
            const latin = new TextDecoder("latin1").decode(bytes);
            let out = "";
            const unesc = (s) => s.replace(/\\([nrtbf()\\])/g, (m, c) => ({ n: "\n", r: "\r", t: "\t", b: "", f: "" }[c] !== undefined ? { n: "\n", r: "\r", t: "\t", b: "", f: "" }[c] : c))
                .replace(/\\(\d{1,3})/g, (m, o) => String.fromCharCode(parseInt(o, 8)));
            const grab = (content) => {
                let txt = "";
                const re = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g; let mm;
                // pull text only inside BT..ET where possible; fall back to whole content
                const scope = content;
                while ((mm = re.exec(scope))) {
                    let s = mm[0];
                    if (s[0] === "(") txt += unesc(s.slice(1, -1));
                    else { const hx = s.slice(1, -1).replace(/\s+/g, ""); for (let k = 0; k + 1 < hx.length; k += 2) txt += String.fromCharCode(parseInt(hx.substr(k, 2), 16)); }
                }
                return txt;
            };
            // decompress every FlateDecode stream and harvest text operators
            const streamRe = /stream\r?\n/g; let sm;
            while ((sm = streamRe.exec(latin))) {
                const start = sm.index + sm[0].length;
                const end = latin.indexOf("endstream", start);
                if (end < 0) continue;
                const header = latin.slice(Math.max(0, sm.index - 220), sm.index);
                // NEVER run the text regex over an embedded image. A scanned/exported
                // page is a ~500 KB JPEG, and the parenthesis regex backtracks over
                // that binary almost forever - the reader appeared to hang and never
                // got as far as reading the pages as pictures.
                if (/DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|RunLengthDecode|\/Subtype\s*\/Image/.test(header)) continue;
                const raw = bytes.slice(start, end);
                let content = "";
                if (/FlateDecode/.test(header)) { try { content = new TextDecoder("latin1").decode(await inflate(raw, false)); } catch (e) { content = ""; } }
                else { content = new TextDecoder("latin1").decode(raw); }
                if (content.length > 400000) content = content.slice(0, 400000);   // safety cap
                if (content && /(BT|Tj|TJ)/.test(content)) out += grab(content) + "\n";
            }
            // also catch any uncompressed text sitting directly in the file (small files only)
            if (out.replace(/\s/g, "").length < 20 && latin.length < 400000 && /(BT|Tj|TJ)/.test(latin)) out += grab(latin);
            return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        }

        // Does the extracted text actually READ like a document, or is it the
        // byte-soup you get from a PDF whose text is drawn as images / encoded with
        // a subset font? A bare length check let that soup through and it was handed
        // to the AI as if it were the report - which then, quite correctly, replied
        // that the document was unreadable. Better to catch it here and say so.
        function looksLikeProse(t) {
            const s = String(t || "");
            const dense = s.replace(/\s/g, "");
            if (dense.length < 40) return false;
            // The real giveaway for byte-soup is CONTROL/BINARY characters, not a low
            // letter count. Judging by letter ratio and common English words wrongly
            // threw out perfectly good number-heavy documents (invoices, PO's, and
            // 8D sheets that are mostly part numbers, dates and measurements).
            // Letters, marks, digits, punctuation and symbols of ANY script are fine (a
            // Tamil or Chinese 8D used to be rejected as junk); control and unassigned
            // characters are what binary garbage is made of.
            const weird = (s.match(/[^\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}\t\n\r]/gu) || []).length;
            if (weird / s.length > 0.08) return false;            // binary / font junk
            const words = s.match(/\p{L}{2,}/gu) || [];
            if (words.length < 8) return false;                   // no real words at all
            // Guard against long unbroken gibberish runs, which garbage produces and
            // documents do not.
            const longestRun = (s.match(/[^\s]{60,}/g) || []).length;
            return longestRun < 5;
        }

        // When a PDF has no extractable text, its pages are almost always stored as
        // pictures (a scan, or an export like ours that screenshots each page). Those
        // pictures are embedded as ordinary JPEG streams, so pull them out and let the
        // VISION model read the pages instead of giving up on the file.
        async function pdfToImages(buf, maxImages) {
            const bytes = new Uint8Array(buf);
            const latin = new TextDecoder("latin1").decode(bytes);
            const out = [];
            const re = /\/DCTDecode/g;   // DCTDecode == JPEG
            let m;
            while ((m = re.exec(latin)) && out.length < (maxImages || 4)) {
                const sIdx = latin.indexOf("stream", m.index);
                if (sIdx < 0) continue;
                let start = sIdx + 6;
                if (latin[start] === "\r") start++;
                if (latin[start] === "\n") start++;
                const eIdx = latin.indexOf("endstream", start);
                if (eIdx < 0) continue;
                const slice = bytes.slice(start, eIdx);
                // Must actually be a JPEG (starts with the SOI marker) and worth sending.
                if (slice.length < 2000 || slice[0] !== 0xFF || slice[1] !== 0xD8) continue;
                let bin = "";
                const CH = 0x8000;
                for (let i = 0; i < slice.length; i += CH) {
                    bin += String.fromCharCode.apply(null, slice.subarray(i, i + CH));
                }
                try { out.push("data:image/jpeg;base64," + btoa(bin)); } catch (e) { /* skip */ }
            }
            return out;
        }

        upBtn.addEventListener("click", () => fileIn.click());
        // The whole drop area opens the file picker too, not only its button.
        const dropEl = document.getElementById("sup8dDrop");
        if (dropEl) dropEl.addEventListener("click", (e) => {
            if (e.target.closest("button") || upBtn.disabled) return;
            fileIn.click();
        });
        fileIn.addEventListener("change", async () => {
            const files = Array.prototype.slice.call(fileIn.files || []);
            fileIn.value = "";
            if (!files.length) return;
            // Not while an evaluation runs (a drop reaches this even with Upload
            // disabled): the answer must describe what is on screen.
            if (evaluating8d) { stat("Please wait for the analysis to finish, then add more files.", "err"); return; }
            // A drop reaches this even while files are being READ (the drop writes
            // straight to the hidden input). Two reads at once overwrote each
            // other's status and could leave the card stuck on a spinner.
            if (reading8d > 0) { stat("Still reading the last file(s) - add more when they are ready.", "err"); return; }
            // Nothing enormous: a huge binary was decoded whole on the main thread
            // and froze the tab with the card locked.
            const MAX_FILE = 25 * 1024 * 1024;
            const tooBig = files.filter((f) => f.size > MAX_FILE).map((f) => f.name);
            if (tooBig.length) {
                stat("Too large to read (max 25 MB): " + tooBig.join(", ") + ". Send a smaller file, or paste the text.", "err");
                if (tooBig.length === files.length) return;
            }
            stat("Reading " + files.length + " file(s)…");
            // Reading a big PDF takes a few seconds - show that something is happening.
            reading8d++; lock8d();
            // Kept so a drop that adds NOTHING (every file unreadable) gives the
            // earlier evaluation back instead of wiping it.
            const prevResult = { html: resultEl.innerHTML, hidden: resultEl.hidden, copy: copyBtn.hidden };
            copyBtn.hidden = true;     // the result it would copy no longer matches the files
            resultEl.innerHTML = '<div class="cases-loading"><span class="spin"></span>' +
                "<span>Reading " + files.length + " file(s)…</span></div>";
            resultEl.hidden = false;
            let added = 0, unreadable = [], pageScans = 0, scanNote = "";
            for (const f of files) {
                if (f.size > MAX_FILE) continue;          // already reported above
                const nm = (f.name || "").toLowerCase();
                try {
                    if (f.type.indexOf("image/") === 0 || /\.(png|jpe?g|gif|webp|bmp)$/.test(nm)) {
                        const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
                        if (typeof url === "string" && url.indexOf("data:") === 0) {
                            // Downscale like the scanned-PDF branch below. A phone
                            // photo of a supplier sheet is several MB and base64
                            // inflates it by a further ~33%, which made the request
                            // enormous: a long wait and then "every AI service is
                            // busy" because the free vision models refused it.
                            let u = url;
                            try { u = await shrinkImage(url, 1100, 0.85); } catch (e) { /* keep the original */ }
                            items.push({ kind: "image", url: u, name: f.name }); added++;
                        }
                    } else if (/\.(docx|docm|dotx|xlsx|xlsm|pptx|pptm|odt|ods|odp)$/.test(nm) ||
                               /officedocument|opendocument/.test(f.type)) {
                        // Word, Excel, PowerPoint and OpenDocument files are ZIP packages;
                        // what is inside decides how they are read.
                        const buf = await f.arrayBuffer();
                        let got = null;
                        if (isZipBuf(buf)) { try { got = await officeToText(buf); } catch (err) { got = null; } }
                        else {
                            // A mis-named MHTML / HTML file saved with an Office extension.
                            try { const t = legacyDocToText(buf); if (looksLikeProse(t)) got = { text: t, kind: "Document" }; } catch (e) { got = null; }
                        }
                        // A sheet of numbers is not "prose" - any real cell text counts.
                        const enough = got && (looksLikeProse(got.text) ||
                            (/Excel|OpenDocument/.test(got.kind) && got.text.replace(/\s/g, "").length >= 10));
                        if (enough) { items.push({ kind: "doc", name: f.name, text: got.text, label: got.kind, size: f.size }); added++; }
                        else unreadable.push(f.name);
                    } else if (/\.pdf$/.test(nm) || f.type === "application/pdf") {
                        const abuf = await f.arrayBuffer();
                        let text = "", pdfJsOk = true;
                        try { text = await pdfJsText(abuf); } catch (e) { pdfJsOk = false; }
                        if (!pdfJsOk) { try { text = await pdfToText(abuf); } catch (e) { text = ""; } }
                        if (looksLikeProse(text)) {
                            items.push({ kind: "doc", name: f.name, text: text, label: "PDF document", size: f.size }); added++;
                            // Only a little text for the whole file - a typed cover page or
                            // a repeated footer over SCANNED pages. Treated as text only,
                            // the scanned D3-D8 pages never reached the AI. Send the pages
                            // as pictures too when the text is thin for the page count.
                            if (pdfJsOk && text.replace(/\s+/g, " ").length < 2500) {
                                let pg = [];
                                try { pg = await pdfJsPageImages(abuf, 6); } catch (e) { pg = []; }
                                const total = pg.total || pg.length;
                                if (pg.length && text.length / Math.max(1, total) < 600) {
                                    for (let pi = 0; pi < pg.length; pi++) {
                                        let u = pg[pi];
                                        try { u = await shrinkImage(u, 1100, 0.85); } catch (e) { /* keep original */ }
                                        items.push({ kind: "image", url: u, name: f.name + " - page " + (pi + 1) });
                                    }
                                    scanNote += "  " + f.name + " has little typed text for its " + total +
                                        " page(s), so its pages were also sent as pictures.";
                                }
                            }
                        }
                        else {
                            // No readable text (a scanned PDF) - read the pages as pictures instead.
                            let pages = [];
                            try { pages = pdfJsOk ? await pdfJsPageImages(abuf, 6) : await pdfToImages(abuf, 4); }
                            catch (e) { pages = []; }
                            if (pages.total > pages.length) {
                                scanNote += "  Only the first " + pages.length + " of the " + pages.total + " pages of " + f.name +
                                    " could be sent as pictures — send the Word version or paste the text for the rest.";
                            }
                            if (pages.length) {
                                for (let pi = 0; pi < pages.length; pi++) {
                                    let u = pages[pi];
                                    try { u = await shrinkImage(u, 1100, 0.85); } catch (e) { /* keep original */ }
                                    items.push({ kind: "image", url: u, name: f.name + " - page " + (pi + 1) });
                                }
                                added++;
                                pageScans += pages.length;
                            } else unreadable.push(f.name);
                        }
                    } else if (/\.(txt|csv|tsv|md|log|json|xml|ya?ml|ini|srt|eml)$/.test(nm) || f.type.indexOf("text/plain") === 0 ||
                               f.type === "text/csv" || /json|xml/.test(f.type)) {
                        // Plain text: read it as text. It went through the binary .doc
                        // scan, which dropped symbols such as ° and ± and split every
                        // tab-separated column onto its own line.
                        let text = decodeTextFile(await f.arrayBuffer());
                        if (/\.xml$/.test(nm) && /<\w/.test(text)) text = htmlToText(text) || text;
                        const label = /\.(csv|tsv)$/.test(nm) ? "Table (CSV)" : /\.json$/.test(nm) ? "JSON data" : /\.eml$/.test(nm) ? "Email" : "Text";
                        if (text.replace(/\s/g, "").length >= 20) { items.push({ kind: "doc", name: f.name, text: text, label: label, size: f.size }); added++; }
                        else unreadable.push(f.name);
                    } else if (/\.rtf$/.test(nm) || f.type === "application/rtf" || f.type === "text/rtf") {
                        const text = rtfToText(decodeTextFile(await f.arrayBuffer()));
                        if (looksLikeProse(text)) { items.push({ kind: "doc", name: f.name, text: text, label: "Rich text", size: f.size }); added++; }
                        else unreadable.push(f.name);
                    } else if (/\.(xls|xlt|ppt|pps|pot)$/.test(nm) || f.type === "application/vnd.ms-excel" || f.type === "application/vnd.ms-powerpoint") {
                        // (.dot is a WORD template - it goes to the Word branch below,
                        //  where it is read and labelled as a Word document.)
                        // Old binary Excel / PowerPoint: best effort. A renamed .xlsx / .pptx
                        // (a ZIP) is read properly.
                        const bbuf = await f.arrayBuffer();
                        let got = null;
                        if (isZipBuf(bbuf)) { try { got = await officeToText(bbuf); } catch (e) { got = null; } }
                        else { const t = binaryOfficeText(bbuf); if (t && t.replace(/\s/g, "").length >= 20) got = { text: t, kind: /\.(xls|xlt)$/.test(nm) ? "Excel 97-2003" : "PowerPoint 97-2003" }; }
                        if (got) { items.push({ kind: "doc", name: f.name, text: got.text, label: got.kind, size: f.size }); added++; }
                        else unreadable.push(f.name);
                    } else if (/\.(doc|dot|mht|mhtml|html?|txt)$/.test(nm) || f.type === "application/msword" || f.type.indexOf("text/") === 0) {
                        // Word ".doc" here is normally an MHTML/HTML package (this app's own export).
                        // A ZIP is a renamed Office file (read it by its contents) - never the byte scan.
                        const dbuf = await f.arrayBuffer();
                        let text = "", label = /\.html?$/.test(nm) ? "Web page" : "Word document";
                        if (isZipBuf(dbuf)) { try { const g = await officeToText(dbuf); text = g.text; label = g.kind; } catch (e) { text = ""; } }
                        else {
                            try { text = legacyDocToText(dbuf); } catch (e) { text = ""; }
                            if (!looksLikeProse(text) && /\.doc$/.test(nm)) text = binaryOfficeText(dbuf);
                        }
                        if (looksLikeProse(text)) { items.push({ kind: "doc", name: f.name, text: text, label: label, size: f.size }); added++; }
                        else unreadable.push(f.name);
                    } else {
                        // Unknown extension — read it by its contents before giving up.
                        try {
                            const ubuf = await f.arrayBuffer();
                            let text = "", label = "Document";
                            if (isZipBuf(ubuf)) { try { const g = await officeToText(ubuf); text = g.text; label = g.kind; } catch (e) { text = ""; } }
                            else {
                                const asText = decodeTextFile(ubuf);
                                if (looksLikeProse(asText)) text = asText;
                                else { try { text = legacyDocToText(ubuf); } catch (e) { text = ""; } }
                            }
                            if (looksLikeProse(text)) { items.push({ kind: "doc", name: f.name, text: text, label: label, size: f.size }); added++; }
                            else unreadable.push(f.name);
                        } catch (err2) { unreadable.push(f.name); }
                    }
                } catch (e) { unreadable.push(f.name); }
            }
            renderThumbs();
            // Reading finished - take the spinner away again.
            if (added) { resultEl.innerHTML = ""; resultEl.hidden = true; }
            else { resultEl.innerHTML = prevResult.html; resultEl.hidden = prevResult.hidden; copyBtn.hidden = prevResult.copy; }
            reading8d--; lock8d();
            // Name the button as it actually reads now (it changes with the mode).
            let msg = added ? (added + " file(s) added — press " + (analyzeBtn.textContent || "Analyse & summarise").trim() + ".") : "";
            if (pageScans) {
                msg += "  That PDF has no text layer (its pages are pictures), so " + pageScans +
                    " page image(s) were taken from it for the AI to read visually." + scanNote;
            } else if (scanNote) {
                msg += scanNote;
            }
            if (unreadable.length) {
                msg += (msg ? "  " : "") + "Could not read: " + unreadable.join(", ") +
                    ". Save it as PDF, Word or Excel and add it again, add a screenshot of it, or paste its text in the box.";
            }
            stat(msg, added ? "ok" : "err");
        });
        textIn.addEventListener("input", refreshClear);

        analyzeBtn.addEventListener("click", async () => {
            const pasted = textIn.value.trim();
            const images = items.filter((it) => it.kind === "image").map((it) => it.url);
            const docs = items.filter((it) => it.kind === "doc");
            if (!images.length && !docs.length && !pasted) { stat("Add a file or paste some text first.", "err"); return; }
            if (reading8d > 0) { stat("Still reading the added file(s) - press Analyse & summarise as soon as they are ready.", ""); return; }
            if (evaluating8d) return;
            // Everything that could change the input is locked until the answer
            // arrives (buttons, the pasted-text box, the thumbnail ✕).
            evaluating8d = true; lock8d();
            // Kept so a failed RE-evaluation does not wipe the earlier good result.
            const prevHtml = resultEl.innerHTML, prevHidden = resultEl.hidden;
            const prevCopy = copyBtn.dataset.txt, prevCopyHidden = copyBtn.hidden;
            // Size limits, told to the user rather than silently applied.
            const LIM = 30000, MAX_IMG = 8;
            const pastedUse = pasted.slice(0, LIM);
            const sendImages = images.slice(0, MAX_IMG);
            const docsAll = docs.map((dd) => "--- " + dd.name + (dd.label ? " (" + dd.label + ")" : "") + " ---\n" + dd.text).join("\n\n");
            const mode = currentMode();
            const evalMode = mode === "eval";
            stat(evalMode ? "Evaluating the supplier 8D report…" : "Reading the content and writing the summary…");
            copyBtn.hidden = true;
            const prevKind = kindEl.textContent, prevKindHidden = kindEl.hidden;
            kindEl.hidden = true;
            // Show a spinner in the results area, like the test-cases page, so it is
            // obvious the AI is working (it can take up to ~90 seconds).
            analyzeBtn.dataset.orig = analyzeBtn.innerHTML;
            analyzeBtn.classList.add("is-loading");
            analyzeBtn.innerHTML = '<span class="btn-spin"></span> ' + (evalMode ? "Evaluating…" : "Analysing…");
            resultEl.innerHTML = '<div class="cases-loading"><span class="spin"></span>' +
                "<span>" + (evalMode ? "Reading the report and checking it against the 8D method…" : "Reading the content and picking out the key points…") + "</span></div>";
            resultEl.hidden = false;

            const sys = "You are an expert analyst who reads documents from ANY field - engineering, quality, " +
                "manufacturing, purchasing, finance, legal, HR, medical, IT, education or everyday life - and explains " +
                "them in simple, plain English that anyone can understand. You are also a senior supplier-quality " +
                "engineer who can judge a supplier 8D report. Answer with short bullet points only.";
            const RULES =
                "RULES:\n" +
                "- Use ONLY what is in the content. Never invent names, numbers, dates or facts.\n" +
                "- SIMPLE WORDS: short everyday words; explain any technical term or abbreviation in a few words the first time.\n" +
                "- Keep the exact numbers, units, names, dates, part numbers and amounts from the content.\n" +
                "- Write in English even if the content is in another language or mixed (for example Tanglish).\n" +
                "- OUTPUT: the TYPE line, then bullet lines only. No headings, no '#', no intro or closing sentence.\n" +
                "- Every bullet starts with '- **Label:** ' (a short bold label), one line each.\n\n";
            const TYPE_LINE =
                "FIRST LINE, exactly: 'TYPE: <what this content is, 2 to 5 words>' - for example " +
                "'TYPE: Supplier 8D report', 'TYPE: Purchase order', 'TYPE: Test report', 'TYPE: Sales spreadsheet', " +
                "'TYPE: Meeting notes', 'TYPE: Email', 'TYPE: Contract'.\n\n";
            const SUMMARY_FORMAT =
                "SUMMARY FORMAT - after the TYPE line:\n" +
                "- **In short:** one sentence (max 25 words) saying what the content is about and its main message.\n" +
                "Then 5 to 9 key points, most important first, each max 22 words, with a label that names the point " +
                "(for example **Purpose:**, **Who:**, **When:**, **Amount:**, **Result:**, **Problem:**, **Decision:**, **Risk:**).\n" +
                "For a spreadsheet, table or CSV: say what the data covers, the totals or counts, the highest and lowest " +
                "values, any trend and anything unusual.\n" +
                "For pictures: describe what is shown and read any visible text or numbers.\n" +
                "- **Action needed:** only if the content asks for something or has a deadline - what, who and by when.\n\n";
            const EVAL_FORMAT =
                "8D EVALUATION FORMAT - after the TYPE line, EXACTLY these 9 bullet lines, max 20 words each:\n" +
                "- **Problem:** the failure + part no / lot / qty\n" +
                "- **Containment:** what was quarantined or sorted (D3)\n" +
                "- **Root cause:** the stated cause - and say if it is a real root cause or a jump-to-cause\n" +
                "- **Actions:** the main corrective / preventive actions (D5-D7)\n" +
                "- **Main gap:** the single biggest thing missing or weak\n" +
                "- **Decision:** Accept or Reject - one short reason only\n" +
                "- **Ask:** first question for the supplier\n" +
                "- **Ask:** second question\n" +
                "- **Ask:** third question\n\n";
            const TASK = mode === "summary"
                ? "TASK: Summarise this content in simple words. Do not judge or grade it - even an 8D report is only summarised.\n\n" + TYPE_LINE + SUMMARY_FORMAT
                : evalMode
                    ? "TASK: Evaluate this supplier 8D report for our quality team; where a discipline is missing or weak, say so plainly.\n" +
                      "If the content is NOT an 8D / RCA / corrective-action report, do not invent 8D content: give the TYPE line, " +
                      "then '- **Not an 8D report:** <one short sentence>' and then the summary format.\n\n" +
                      TYPE_LINE + EVAL_FORMAT + SUMMARY_FORMAT
                    : "TASK: First decide what this content is. If it is a supplier 8D / RCA / corrective-action (CAPA) report, " +
                      "use the 8D EVALUATION FORMAT. For ANY other content - from any field - use the SUMMARY FORMAT " +
                      "(do not mention 8D and do not judge it).\n\n" + TYPE_LINE + EVAL_FORMAT + SUMMARY_FORMAT;
            const promptText = TASK + RULES +
                (pastedUse ? ("CONTENT - pasted text" +
                    (pasted.length > LIM ? " (only the FIRST part is shown - do not report later parts as missing)" : "") +
                    ":\n" + pastedUse + "\n\n") : "") +
                (docs.length ?
                    // Up to 30,000 characters, and say so when a long document is cut.
                    ("CONTENT - text taken from the added file(s)" +
                        (docsAll.length > LIM ? " (only the FIRST part of a long document is shown - do not report later parts as missing)" : "") +
                        ":\n" + docsAll.slice(0, LIM) + "\n\n") : "");
            const prompt = promptText +
                (sendImages.length ? "The attached image(s) are part of the content - read them carefully, including any text in them." : "");
            try {
                // Go through the fallback wrapper: if the preferred service is out
                // of quota the other free ones still answer, instead of showing a
                // raw "Gemini error: You exceeded your current quota" to the user.
                let ans = "", fellBack = null, picturesSkipped = false;
                const provider = localStorage.getItem("aiProvider") || "free";
                const needVision = sendImages.length > 0;
                try {
                    // requireVision: when there are pictures, a service that cannot
                    // SEE them must not answer. Without it the request carried on to
                    // text-only services, the pages were silently dropped, and the
                    // "Evaluation ready" result described nothing it had read.
                    ans = await aiComplete(prompt, sys, false, sendImages, 90000, needVision);
                    fellBack = aiFellBackFrom;      // read now - the chat may change it later
                } catch (e1) {
                    if (needVision && (docs.length || pasted)) {
                        // The pictures could not be read, but there is text: evaluate
                        // the text, and SAY that the pictures were not included.
                        ans = await aiComplete(promptText, sys, false, null, 90000);
                        fellBack = aiFellBackFrom;
                        picturesSkipped = true;
                    } else if (provider !== "free") {
                        // Retry on the free chain only when a different provider was
                        // chosen - on "free" that chain has just failed, and running
                        // it again only doubled the wait before the error.
                        ans = await aiComplete(prompt, sys, true, sendImages, 90000, needVision);   // forced free chain
                        // aiComplete does not record this switch (it was an error, not
                        // a fall-through), so name the provider that failed here.
                        fellBack = provider === "gemini" ? "Google Gemini" : provider === "openrouter" ? "OpenRouter"
                            : provider === "openai" ? "OpenAI" : provider;
                    } else {
                        throw e1;
                    }
                }
                if (!ans || !ans.trim()) throw new Error("empty response");
                // The TYPE line becomes the badge next to "Result".
                const tm = ans.match(/^\s*\**\s*TYPE\s*\**\s*:\s*\**\s*(.+?)\s*\**\s*$/im);
                const kind = tm ? tm[1].replace(/\*\*/g, "").replace(/[.]+$/, "").trim().slice(0, 48) : "";
                const body = tm ? ans.replace(tm[0], "") : ans;
                // Points only: drop any heading line the model adds anyway, and any
                // stray intro/outro prose, so the panel is purely the bullet list.
                const bulletsOnly = body.split(/\r?\n/)
                    .filter((l) => !/^\s*#{1,6}\s/.test(l))            // markdown headings
                    .filter((l) => !/^\s*\*\*[^*]+\*\*\s*:?\s*$/.test(l))   // bold-only pseudo headings
                    .join("\n")
                    .replace(/\n{3,}/g, "\n\n")
                    .trim();
                if (!bulletsOnly && !kind) throw new Error("empty response");
                resultEl.innerHTML = procMdToHtml(bulletsOnly || body);
                resultEl.hidden = false;
                kindEl.textContent = kind; kindEl.hidden = !kind;
                copyBtn.hidden = false; copyBtn.dataset.txt = (kind ? kind + "\n\n" : "") + (bulletsOnly || body);
                refreshClear();
                // Which service actually read the content matters: say so when it
                // was not the one the user chose.
                const notes = [];
                if (fellBack) notes.push(fellBack + " was unavailable, so the free assistant read it instead.");
                if (picturesSkipped) notes.push("The picture(s) could not be read just now, so this result is based on the TEXT only - try again for the pictures.");
                if (images.length > sendImages.length) notes.push("Only the first " + sendImages.length + " of " + images.length + " pictures were sent.");
                if (docsAll.length > LIM) notes.push("The added file is long - only its first 30,000 characters were read.");
                if (pasted.length > LIM) notes.push("The pasted text is long - only its first 30,000 characters were read.");
                const isEval = /\*\*\s*Decision\s*:\s*\*\*/i.test(bulletsOnly) && /\*\*\s*Containment\s*:/i.test(bulletsOnly);
                stat((isEval ? "Evaluation ready" : "Summary ready") + " — review the points below." + (notes.length ? "  (" + notes.join("  ") + ")" : ""), "ok");
            } catch (e) {
                // Take the spinner away and bring back whatever was shown before, so a
                // failed re-evaluation does not wipe an earlier good result.
                resultEl.innerHTML = prevHtml; resultEl.hidden = prevHidden;
                kindEl.textContent = prevKind; kindEl.hidden = prevKindHidden;
                if (prevCopy != null) copyBtn.dataset.txt = prevCopy;
                copyBtn.hidden = prevCopyHidden;
                const why = (e && e.message ? e.message : String(e));
                // Reading PICTURES needs a vision model; the free ones run out long
                // before the text ones do. Say what will actually work instead of
                // just reporting that everything is busy.
                const imageOnly = images.length && !docs.length && !pasted;
                stat(imageOnly
                    ? ("Could not read the picture(s): " + why +
                       "  Reading images needs a vision model and the free ones are used up for now. " +
                       "Quickest fix: paste the text into the box above (that uses the text models, " +
                       "which still have quota). Otherwise add your own Google Gemini key in Ask AI → settings, " +
                       "or try again later.")
                    : ("Could not analyse the content: " + why +
                       "  Try again in a minute, or add your own key in Ask AI → settings."),
                    "err");
            } finally {
                analyzeBtn.classList.remove("is-loading");
                syncModeUi();          // the label for the mode chosen now
                evaluating8d = false; lock8d(); refreshClear();
            }
        });

        copyBtn.addEventListener("click", () => {
            const t = copyBtn.dataset.txt || resultEl.textContent || "";
            if (!t) return;
            // Older copy method, for when the clipboard API is missing or refused
            // (it used to fail silently).
            const legacyCopy = () => {
                const ta = document.createElement("textarea");
                ta.value = t;
                ta.style.cssText = "position:fixed;left:-9999px;top:0";
                document.body.appendChild(ta);
                ta.select();
                let ok = false;
                try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
                ta.remove();
                stat(ok ? "Copied the evaluation points." : "Could not copy automatically — select the points and press Ctrl+C.", ok ? "ok" : "err");
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(t).then(() => stat("Copied the evaluation points.", "ok"), legacyCopy);
            } else {
                legacyCopy();
            }
        });
        clrBtn.addEventListener("click", () => {
            items = []; textIn.value = ""; renderThumbs();
            resultEl.hidden = true; resultEl.innerHTML = "";
            kindEl.hidden = true; kindEl.textContent = "";
            copyBtn.hidden = true; clrBtn.hidden = true; stat("");
            refreshClear();     // brings back the "Your summary will appear here" note
        });
    })();

    clearBtn.addEventListener("click", () => {
        if (rcaBusy()) return;
        const hasWork = (!reportBox.hidden && reportBox.innerHTML.trim()) || photos.length ||
            Object.keys(fields).some((k) => fields[k].tagName !== "SELECT" && fields[k].value.trim());
        if (hasWork && !confirm("Clear the RCA form, photos and report?\n\nAnything not saved (Save RCA) is lost.")) return;
        Object.keys(fields).forEach((k) => { if (fields[k].tagName !== "SELECT") fields[k].value = ""; });
        photos = []; renderPhotoTray();
        reportBox.hidden = true; reportBox.innerHTML = ""; syncRcaTools();
        methodBox.hidden = true; methodBtn.textContent = "📋 Show RCA procedure";
        setStatus("");
        try { localStorage.removeItem("rcaState"); } catch (e) { /* ignore */ }
    });
    Object.keys(fields).forEach((k) => fields[k].addEventListener("input", save));

    // Changing the Status in the form updates the Status in the report on screen.
    ["input", "change"].forEach((ev) => fields.status.addEventListener(ev, () => {
        const cell = reportBox.querySelector("[data-rca-status]");
        if (cell) { cell.textContent = fields.status.value || "Open"; save(); }
    }));
    // ...and so do the RCA No., Rev, Issued Date and Product (header box + footer
    // line), which used to keep the values from when the report was generated.
    ["no", "rev", "issue", "product"].forEach((k) => fields[k] && fields[k].addEventListener("input", () => {
        if (!reportBox.hidden && reportBox.querySelector(".rca-8d-topbox")) headerFromFields(null);
    }));

    // ---------- My RCAs library (save / list / reopen / delete) ----------
    const rcaModal = document.getElementById("rcaModal");
    const rcaList = document.getElementById("rcaList");

    function loadLib() {
        try { return JSON.parse(localStorage.getItem("savedRcas") || "[]"); } catch (e) { return []; }
    }
    function storeLib(arr) {
        try { localStorage.setItem("savedRcas", JSON.stringify(arr)); return true; }
        catch (e) { alert("Storage full — the RCA was NOT saved. Delete old RCAs in My RCAs, or download the RCA as PDF/Word instead."); return false; }
    }

    async function saveCurrentRca() {
        if (rcaBusy()) return;
        if (reportBox.hidden || !reportBox.innerHTML.trim()) {
            setStatus("Generate or load an RCA before saving it.", "err");
            if (rcaModal) rcaModal.hidden = true;
            return;
        }
        // Suggest a name, but let the user type their own.
        const suggested = (fields.no.value.trim() || fields.product.value.trim() || "RCA") +
            (fields.product.value.trim() && fields.no.value.trim() ? " — " + fields.product.value.trim() : "");
        const typed = prompt("Name this RCA:", suggested);
        if (typed === null) return;                   // cancelled
        const name = typed.trim() || suggested;

        const lib = loadLib();
        // Saving under an existing name updates it - but ask first: the pre-filled
        // name (e.g. "RCA") silently replaced a different RCA saved under it.
        const at = lib.findIndex((r) => r.name === name);
        if (at >= 0 && !confirm('A saved RCA called "' + name + '" already exists.\n\n' +
                "OK = replace it with the RCA on screen\nCancel = keep it (nothing is saved)")) return;
        // The list used to be cut to 50, silently deleting the oldest saved RCA.
        if (at < 0 && lib.length >= 50) {
            alert("You already have 50 saved RCAs. Delete some old ones in My RCAs, then save again.");
            return;
        }
        // Photos are already stored at print size when they are added, so the
        // snapshot is taken at once - no wait in which Clear / Open could change
        // the report being saved.
        const small = photos.slice();
        const snap = {
            id: at >= 0 ? lib[at].id : "rca_" + Date.now(),
            name: name,
            when: new Date().toLocaleString(),
            f: Object.keys(fields).reduce((a, k) => (a[k] = fields[k].value, a), {}),
            photos: small,
            html: reportBox.innerHTML
        };
        if (at >= 0) lib.splice(at, 1);
        lib.unshift(snap);
        if (!storeLib(lib)) {
            setStatus("The RCA was NOT saved - the browser storage is full.", "err");
            return;
        }
        renderLib();
        setStatus('RCA saved as “' + name + '”.', "ok");
    }

    function openRca(id) {
        if (rcaBusy()) return;
        const snap = loadLib().find((r) => r.id === id);
        if (!snap) return;
        if (!reportBox.hidden && reportBox.querySelector(".rca-body") &&
            !confirm('Open "' + snap.name + '"?\n\nThis replaces the RCA on screen. Save it first (Save RCA) if you need it.')) return;
        // A field the saved RCA does not have (saved before that field existed)
        // is emptied - it used to keep the previous RCA's value.
        Object.keys(fields).forEach((k) => {
            if (snap.f[k] != null) fields[k].value = snap.f[k];
            else if (fields[k].tagName !== "SELECT") fields[k].value = "";
        });
        photos = (snap.photos || []).slice(); renderPhotoTray();
        reportBox.innerHTML = snap.html;
        reportBox.hidden = false;
        // the same controls a newly made report gets (add row, ×, redraw fishbone)
        bindReportControls();
        // ...and the report toolbar (Download / Export PDF / zoom) that a
        // generated report shows - an opened RCA left them hidden.
        if (typeof syncRcaTools === "function") syncRcaTools();
        // The logo baked into the saved HTML may not be the current RCA logo that
        // Word and the ✕ button use - show the current one so all three agree.
        putRcaLogo(rcaLogoData() || "");
        if (rcaModal) rcaModal.hidden = true;
        save();
        reportBox.scrollIntoView({ behavior: "smooth", block: "start" });
        setStatus("Opened saved RCA: " + snap.name, "ok");
    }

    function deleteRca(id) {
        if (!confirm("Delete this saved RCA?")) return;
        storeLib(loadLib().filter((r) => r.id !== id));
        renderLib();
    }

    function renderLib() {
        const lib = loadLib();
        if (!lib.length) { rcaList.innerHTML = '<p class="reports-empty">No saved RCAs yet. Generate one, then press “Save the RCA on screen”.</p>'; return; }
        rcaList.innerHTML = lib.map((r) =>
            '<div class="reports-row"><div class="reports-row-info"><b>' + esc(r.name) + "</b><small>" + esc(r.when) + "</small></div>" +
            '<div class="reports-row-btns"><button type="button" data-open="' + r.id + '">Open</button>' +
            '<button type="button" data-ren="' + r.id + '">Rename</button>' +
            '<button type="button" class="reports-del" data-del="' + r.id + '">Delete</button></div></div>'
        ).join("");
        rcaList.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openRca(b.dataset.open)));
        rcaList.querySelectorAll("[data-ren]").forEach((b) => b.addEventListener("click", () => renameRca(b.dataset.ren)));
        rcaList.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteRca(b.dataset.del)));
    }

    function renameRca(id) {
        const lib = loadLib();
        const entry = lib.find((r) => r.id === id);
        if (!entry) return;
        const typed = prompt("Rename this RCA:", entry.name);
        if (typed === null) return;
        const name = typed.trim();
        if (!name || name === entry.name) return;
        if (lib.some((r) => r.id !== id && r.name === name)) {
            alert('There is already a saved RCA called "' + name + '". Please use a different name.');
            return;
        }
        entry.name = name;
        storeLib(lib);
        renderLib();
    }

    const rcaSaveBtn = document.getElementById("rcaSave");
    const rcaLibBtn = document.getElementById("rcaLibrary");
    const rcaSaveInModal = document.getElementById("rcaSaveInModal");
    if (rcaSaveBtn) rcaSaveBtn.addEventListener("click", saveCurrentRca);
    if (rcaSaveInModal) rcaSaveInModal.addEventListener("click", saveCurrentRca);
    if (rcaLibBtn) rcaLibBtn.addEventListener("click", () => { renderLib(); if (rcaModal) rcaModal.hidden = false; });

    // ---- the RCA report's OWN logo ----
    // Stored as "rcaLogo", separate from the test report's "companyLogo", so the
    // two reports can carry different logos. Used by the on-screen report, the
    // Word (.docx) export and the PDF via rcaLogoData().
    const rcaLogoBtn = document.getElementById("rcaLogoBtn");
    const rcaLogoFile = document.getElementById("rcaLogoFile");

    // The report HTML is rebuilt on every render, so the logo slot comes back as
    // a fresh element: put the "adjusting" state back on it, or the button looked
    // off while dragging was still on (and vice versa).
    function syncRcaLogoAdjust() {
        const slot = reportBox.querySelector(".rca-8d-logo");
        if (!slot) return;
        const btn = slot.querySelector(".rca-logo-adjust");
        if (btn) btn.classList.toggle("tool-active", rcaLogoCropMode);
        slot.style.cursor = rcaLogoCropMode ? "move" : "";
    }

    function putRcaLogo(url) {
        // Fill the header's logo slot rather than re-rendering: renderReport()
        // needs its content argument, so calling it bare would wipe the report
        // that is on screen.
        const slot = reportBox.querySelector(".rca-8d-logo");
        if (!slot) return;
        slot.innerHTML = rcaLogoMarkup(url);
        syncRcaLogoAdjust();
    }

    // Removes whatever logo the RCA report shows - its own logo OR the test
    // report's company logo it falls back to (that one could not be removed
    // before: it answered "No RCA logo is set" and the logo stayed). The
    // choice is remembered, so the PDF and Word exports have no logo either.
    // The test report's own logo is not touched.
    function removeRcaLogo() {
        if (!rcaLogoData()) { setStatus("The RCA report has no logo.", ""); return; }
        if (!confirm("Remove the logo from the RCA report?\n\nThe PDF and Word files will have no logo. The test report's logo is not changed.")) return;
        try { localStorage.setItem("rcaLogo", RCA_NO_LOGO); } catch (err) { /* storage full - still clear the view */ }
        putRcaLogo("");
        setStatus("Logo removed from the RCA report. Click 🖼 Add logo to choose one again.", "ok");
    }

    if (rcaLogoBtn && rcaLogoFile) {
        rcaLogoBtn.addEventListener("click", () => rcaLogoFile.click());
        // The logo area in the report itself: click it to pick the image,
        // right-click it to remove the logo.
        const logoSlot = (e) => {
            const s = e.target && e.target.closest ? e.target.closest(".rca-8d-logo") : null;
            return s && reportBox.contains(s) && !s.closest(".rca-pdf") ? s : null;
        };
        reportBox.addEventListener("click", (e) => {
            const slot = logoSlot(e);
            if (!slot) return;
            if (e.target.closest(".rca-logo-x")) { e.preventDefault(); removeRcaLogo(); return; }
            // "⤢ Adjust": switch panning on / off instead of opening the file dialog.
            const adj = e.target.closest(".rca-logo-adjust");
            if (adj) {
                e.preventDefault();
                rcaLogoCropMode = !rcaLogoCropMode;
                adj.classList.toggle("tool-active", rcaLogoCropMode);
                slot.style.cursor = rcaLogoCropMode ? "move" : "";
                setStatus(rcaLogoCropMode
                    ? "Adjust the logo: drag to move, scroll to zoom, double-click to reset. Press Adjust again when done."
                    : "Logo position saved - the PDF, View / Print and Word file use it too.", "ok");
                return;
            }
            // While adjusting, a click must not re-open the picker.
            if (rcaLogoCropMode) { e.preventDefault(); return; }
            rcaLogoFile.click();
        });

        // ---- pan / zoom / reset for the RCA logo (same feel as the test report) ----
        const cropImg = () => reportBox.querySelector(".rca-8d-logo .rca-doc-logo8d");
        const applyRcaLogoCrop = () => {
            const im = cropImg();
            if (im) im.setAttribute("style", rcaLogoCropStyle());
        };
        let panning = false, sx = 0, sy = 0, ox = 0, oy = 0;
        reportBox.addEventListener("pointerdown", (e) => {
            const slot = logoSlot(e);
            if (!slot || !rcaLogoCropMode || (e.target.closest && e.target.closest("button"))) return;
            panning = true; sx = e.clientX; sy = e.clientY; ox = rcaLogoCrop.x; oy = rcaLogoCrop.y;
            try { slot.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        });
        reportBox.addEventListener("pointermove", (e) => {
            if (!panning) return;
            rcaLogoCrop.x = ox + (e.clientX - sx);
            rcaLogoCrop.y = oy + (e.clientY - sy);
            applyRcaLogoCrop();
        });
        const endPan = () => { if (panning) { panning = false; rcaLogoCropSave(); } };
        reportBox.addEventListener("pointerup", endPan);
        reportBox.addEventListener("pointerleave", endPan);
        reportBox.addEventListener("dblclick", (e) => {
            if (!logoSlot(e) || !rcaLogoCropMode) return;
            rcaLogoCrop = { scale: 1, x: 0, y: 0 };
            applyRcaLogoCrop(); rcaLogoCropSave();
        });
        reportBox.addEventListener("wheel", (e) => {
            if (!logoSlot(e) || !rcaLogoCropMode) return;
            e.preventDefault();
            const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            rcaLogoCrop.scale = Math.min(6, Math.max(0.3, (rcaLogoCrop.scale || 1) * f));
            applyRcaLogoCrop(); rcaLogoCropSave();
        }, { passive: false });
        reportBox.addEventListener("contextmenu", (e) => {
            if (!logoSlot(e)) return;
            e.preventDefault();
            removeRcaLogo();
        });
        rcaLogoFile.addEventListener("change", () => {
            const f = rcaLogoFile.files && rcaLogoFile.files[0];
            rcaLogoFile.value = "";
            if (!f) return;
            if (!/^image\//.test(f.type)) { setStatus("Please choose an image file (PNG or JPG).", "err"); return; }
            const r = new FileReader();
            r.onload = function (e) {
                const url = String(e.target.result || "");
                try { localStorage.setItem("rcaLogo", url); }
                catch (err) {
                    setStatus("That image is too large to store — use a smaller PNG (about 300-600 px wide).", "err");
                    return;
                }
                putRcaLogo(url);
                setStatus("RCA report logo set. It is separate from the test report's logo, and is used in the Word and PDF exports too.", "ok");
            };
            r.onerror = function () { setStatus("Could not read that image.", "err"); };
            r.readAsDataURL(f);
        });
        // Right-click / long-press the button to clear it again.
        rcaLogoBtn.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            removeRcaLogo();
        });
    }

})();

// ===========================================
// The report's starting indent = the width of FIVE SPACES in the report's own
// font (the user's rule: "5 spaces"). Measured rather than guessed, because a
// space is not the same width in every font, and written to --indent5, which
// every section box and list in style.css uses.
// ===========================================
function applyFiveSpaceIndent() {

    const probe = document.querySelector("#report .editor") || document.body;

    const span = document.createElement("span");
    const cs = window.getComputedStyle(probe);
    span.style.cssText = "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0";
    // Each property separately: the "font" shorthand often reads back empty, and
    // the span then measured in whatever font its parent happened to use.
    span.style.fontFamily = cs.fontFamily;
    span.style.fontSize = cs.fontSize;
    span.style.fontWeight = cs.fontWeight;
    span.style.fontStyle = cs.fontStyle;
    span.style.letterSpacing = cs.letterSpacing;
    span.textContent = "     ";           // exactly five spaces
    document.body.appendChild(span);

    const w = span.getBoundingClientRect().width;
    span.remove();

    // A sane value only: a broken measurement must not push the text off the page.
    if (w > 2 && w < 80) document.documentElement.style.setProperty("--indent5", w.toFixed(2) + "px");

}

// After the fonts are ready, so the measurement uses the real report font.
applyFiveSpaceIndent();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyFiveSpaceIndent).catch(() => {});
window.addEventListener("load", applyFiveSpaceIndent);

// ===========================================
// REPORT UX: rich-text toolbar, watermark, zoom (all stay in Times New Roman)
// ===========================================
(function () {
    const reportEl = document.getElementById("report");
    if (!reportEl) return;

    // ---------- rich-text toolbar (bold / bullet / numbered / clear) ----------
    // Floats above the editable section that is focused. Font is unchanged - the
    // report already forces Times New Roman, so only structure/emphasis changes.
    // Alignment icons drawn as four lines (like Word's), so they read at a glance.
    // widths: the length of each line; side: "c" centred, "r" right-aligned.
    const ALIGN_ICON = (widths, side) => '<svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">' +
        widths.map((w, i) => {
            const x = side === "c" ? (14 - w) / 2 : side === "r" ? 14 - w : 0;
            return '<rect x="' + x + '" y="' + (i * 3 + 0.5) + '" width="' + w + '" height="1.6" rx="0.6" fill="currentColor"/>';
        }).join("") + "</svg>";

    const bar = document.createElement("div");
    bar.className = "rte-bar";
    bar.hidden = true;
    bar.innerHTML =
        '<button type="button" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>' +
        '<button type="button" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>' +
        '<button type="button" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>' +
        '<span class="rte-sep"></span>' +
        '<button type="button" data-cmd="justifyLeft" title="Align left" class="rte-ico">' + ALIGN_ICON([10, 7, 10, 6]) + "</button>" +
        '<button type="button" data-cmd="justifyCenter" title="Centre" class="rte-ico">' + ALIGN_ICON([10, 6, 10, 6], "c") + "</button>" +
        '<button type="button" data-cmd="justifyRight" title="Align right" class="rte-ico">' + ALIGN_ICON([10, 7, 10, 6], "r") + "</button>" +
        '<button type="button" data-cmd="justifyFull" title="Justify" class="rte-ico">' + ALIGN_ICON([10, 10, 10, 10]) + "</button>" +
        '<span class="rte-sep"></span>' +
        '<button type="button" data-cmd="insertUnorderedList" title="Bullet list">• List</button>' +
        '<button type="button" data-cmd="insertOrderedList" title="Numbered list">1. List</button>' +
        '<button type="button" data-cmd="outdent" title="Decrease indent">⇤</button>' +
        '<button type="button" data-cmd="indent" title="Increase indent">⇥</button>' +
        '<span class="rte-sep"></span>' +
        '<button type="button" data-cmd="removeFormat" title="Clear formatting">✕ Clear</button>';
    document.body.appendChild(bar);

    let activeField = null;
    // Anything you can type into inside the report or the RCA report: the text
    // sections, table cells, headings, captions and header fields. (Dates are
    // left out - they are a fixed DD/MM/YYYY value, not formatted text.)
    const isEditor = (el) => {
        if (!el || !el.getAttribute || el.getAttribute("contenteditable") !== "true") return false;
        if (el.id && typeof DATE_FIELDS !== "undefined" && DATE_FIELDS.indexOf(el.id) >= 0) return false;
        if (el.closest(".date-wrap")) return false;
        // One-line inline fields (Report No., Revision, figure captions, an added
        // page's title) are part of a row, not a text block: a list or an
        // alignment command inside them breaks the row and the page-2 header copy.
        if (el.tagName === "SPAN" || el.matches(".fig-text, .manual-title")) return false;
        return !!el.closest("#report, #rcaReport, .cases-procedure");
    };

    function placeBar(field) {
        const r = field.getBoundingClientRect();
        bar.hidden = false;
        // clamp inside the viewport
        let top = r.top - bar.offsetHeight - 6;
        if (top < 6) top = r.top + 6;
        let left = r.left;
        const maxLeft = window.innerWidth - bar.offsetWidth - 8;
        if (left > maxLeft) left = Math.max(8, maxLeft);
        bar.style.top = top + "px";
        bar.style.left = left + "px";
    }

    // Shows which options are ON for the text the cursor is in, like Word's ribbon.
    function syncBarState() {
        if (bar.hidden) return;
        bar.querySelectorAll("button[data-cmd]").forEach((b) => {
            let on = false;
            try { on = document.queryCommandState(b.dataset.cmd); } catch (x) { on = false; }
            b.classList.toggle("on", !!on);
        });
    }
    document.addEventListener("selectionchange", () => {
        if (!bar.hidden && isEditor(document.activeElement)) syncBarState();
    });

    document.addEventListener("focusin", (e) => {
        if (isEditor(e.target)) { activeField = e.target; placeBar(activeField); syncBarState(); }
    });
    document.addEventListener("focusout", (e) => {
        if (isEditor(e.target)) setTimeout(() => { if (!bar.contains(document.activeElement) && !isEditor(document.activeElement)) bar.hidden = true; }, 150);
    });
    window.addEventListener("scroll", () => { if (!bar.hidden && activeField) placeBar(activeField); }, true);

    bar.querySelectorAll("button").forEach((b) => {
        // mousedown (not click) so the field keeps its selection/focus
        b.addEventListener("mousedown", (e) => {
            e.preventDefault();
            if (!activeField) return;
            activeField.focus();
            // Lists and alignment need a block to work on. An empty box (or one
            // holding bare text) has no block, so the browser either did nothing
            // or wrapped the WHOLE box - which is why lists misbehaved.
            try { document.execCommand("styleWithCSS", false, false); } catch (x) { /* ignore */ }
            try { document.execCommand("defaultParagraphSeparator", false, "div"); } catch (x) { /* ignore */ }
            try { document.execCommand(b.dataset.cmd, false, null); } catch (x) { /* ignore */ }
            // A list typed here is the user's own, not a generated procedure, so it
            // keeps the plain list style (the numbered-step class is for those).
            // Turning a list off leaves empty <span style="text-indent:0"> wrappers
            // behind (the browser copies the box's indent onto them) - unwrap them,
            // or they pile up in the saved report.
            activeField.querySelectorAll('span[style*="text-indent"]').forEach((s) => {
                if (s.getAttribute("style").replace(/text-indent\s*:[^;]*;?/gi, "").trim()) return;
                while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s);
                s.remove();
            });
            activeField.dispatchEvent(new Event("input", { bubbles: true }));
            syncBarState();
        });
    });

    // ---------- watermark ----------
    const wmSelect = document.getElementById("wmSelect");
    function applyWatermark(text) {
        reportEl.querySelectorAll(".page-wm").forEach((el) => el.remove());
        if (!text) return;
        reportEl.querySelectorAll(".page").forEach((page) => {
            const wm = document.createElement("div");
            wm.className = "page-wm";
            wm.textContent = text;
            page.appendChild(wm);
        });
    }
    if (wmSelect) {
        let saved = "";
        try { saved = localStorage.getItem("reportWatermark") || ""; } catch (e) { /* ignore */ }
        wmSelect.value = saved;
        applyWatermark(saved);
        wmSelect.addEventListener("change", () => {
            applyWatermark(wmSelect.value);
            try { localStorage.setItem("reportWatermark", wmSelect.value); } catch (e) { /* ignore */ }
        });
    }
    // Re-apply the watermark after actions that rebuild the pages (load draft, new report).
    window.reapplyWatermark = () => { if (wmSelect) applyWatermark(wmSelect.value); };

    // ---------- zoom (screen preview only; reset during PDF export) ----------
    const zoomIn = document.getElementById("zoomIn");
    const zoomOut = document.getElementById("zoomOut");
    const zoomReset = document.getElementById("zoomReset");
    const zoomPct = document.getElementById("zoomPct");
    let zoom = 1;
    try { zoom = parseFloat(localStorage.getItem("reportZoom")) || 1; } catch (e) { zoom = 1; }
    function applyZoom() {
        zoom = Math.min(1.6, Math.max(0.5, Math.round(zoom * 100) / 100));
        reportEl.style.transform = zoom === 1 ? "" : "scale(" + zoom + ")";
        if (zoomPct) zoomPct.textContent = Math.round(zoom * 100) + "%";
        try { localStorage.setItem("reportZoom", String(zoom)); } catch (e) { /* ignore */ }
    }
    if (zoomIn) zoomIn.addEventListener("click", () => { zoom += 0.1; applyZoom(); });
    if (zoomOut) zoomOut.addEventListener("click", () => { zoom -= 0.1; applyZoom(); });
    if (zoomReset) zoomReset.addEventListener("click", () => { zoom = 1; applyZoom(); });
    applyZoom();
})();

// The zoom row belongs to the RCA report: it appears with it and goes away
// with it (a zoom control over nothing is just confusing).
function syncRcaTools() {
    const tools = document.getElementById("rcaTools");
    const box = document.getElementById("rcaReport");
    if (tools && box) tools.hidden = box.hidden;
}

// ---------- zoom for the RCA / 8D report (screen preview only) ----------
// Deliberately the same control, keys and limits as the test report above, so
// both documents behave the same way. The PDF build clears it (see
// `.exporting` in buildRcaPdf) because its page breaks are measured with
// getBoundingClientRect(), which a CSS scale would falsify.
(function () {
    const box = document.getElementById("rcaReport");

    if (!box) return;

    const zIn = document.getElementById("rcaZoomIn");
    const zOut = document.getElementById("rcaZoomOut");
    const zReset = document.getElementById("rcaZoomReset");
    const zPct = document.getElementById("rcaZoomPct");

    let zoom = 1;
    try { zoom = parseFloat(localStorage.getItem("rcaZoom")) || 1; } catch (e) { zoom = 1; }

    function applyRcaZoom() {
        zoom = Math.min(1.6, Math.max(0.5, Math.round(zoom * 100) / 100));
        box.style.transform = zoom === 1 ? "" : "scale(" + zoom + ")";
        if (zPct) zPct.textContent = Math.round(zoom * 100) + "%";
        try { localStorage.setItem("rcaZoom", String(zoom)); } catch (e) { /* ignore */ }
    }

    if (zIn) zIn.addEventListener("click", () => { zoom += 0.1; applyRcaZoom(); });
    if (zOut) zOut.addEventListener("click", () => { zoom -= 0.1; applyRcaZoom(); });
    if (zReset) zReset.addEventListener("click", () => { zoom = 1; applyRcaZoom(); });

    applyRcaZoom();
    syncRcaTools();
})();
