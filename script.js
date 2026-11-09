/* ============================================================
   BULUŞMA PLANLAYICI — script.js
   Akış: Karşılama → Form → Sevinç Pop-up → Özet Ekranı
   ============================================================ */

// ------------------------------------------------------------
// AYARLAR
// ------------------------------------------------------------

// Google Sheets bağlantısı: Google Apps Script "Web App" dağıtım URL'sini
// aşağıdaki yer tutucuya yapıştırın. (Doctype: Code.gs POST isteklerini doPost ile karşılamalıdır.)
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbzVTEGIIN5S4MKlD88XrCCPG50eTI7Yo34OkBp_NdDgopa3RyyP89I8fob8SvTaAlc6/exec";

const NO_WARNING_DEFAULT = "Bu özellik çalışmamaktadır 😅";
const NO_WARNING_ANGRY   = "Lütfen abartmayın 🛑";

// ------------------------------------------------------------
// DURUM (STATE)
// ------------------------------------------------------------

let noCount = 0;          // "Hayır" butonuna basılma sayısı
let toastTimer = null;    // toast gizleme zamanlayıcısı

// ------------------------------------------------------------
// DOM REFERANSLARI
// ------------------------------------------------------------

const screenWelcome  = document.getElementById("screen-welcome");
const screenForm     = document.getElementById("screen-form");
const screenSummary  = document.getElementById("screen-summary");

const btnYes   = document.getElementById("btn-yes");
const btnNo    = document.getElementById("btn-no");
const btnBack  = document.getElementById("btn-back");

const detailForm    = document.getElementById("detail-form");
const customPlace   = document.getElementById("custom-place");
const otherRadio    = document.getElementById("other-radio");
const dateInput     = document.getElementById("date-input");
const timeInput     = document.getElementById("time-input");
const notesInput    = document.getElementById("notes-input");

const toast          = document.getElementById("toast");
const modalCelebrate = document.getElementById("modal-celebrate");
const modalScoreText = document.getElementById("modal-score-text");
const btnCloseModal  = document.getElementById("btn-close-modal");
const summaryList    = document.getElementById("summary-list");

// ------------------------------------------------------------
// YARDIMCI FONKSİYONLAR
// ------------------------------------------------------------

/** Aktif ekranı değiştirir. */
function showScreen(screenEl) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  screenEl.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Uyarı pop-up'ı (toast) gösterir. */
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");

  // Önceki zamanlayıcıyı temizle (üst üste basmalar için)
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

/** Tarihi okunur formata çevirir (gg.aa.yyyy). */
function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Saati okunur formata çevirir (ss:dd). */
function formatTime(t) {
  return t ? t : "—";
}

// ------------------------------------------------------------
// EKRAN 1: EVET / HAYIR
// ------------------------------------------------------------

btnNo.addEventListener("click", () => {
  noCount++;
  // 3'ten fazla basılırsa mesaj değişir
  showToast(noCount > 3 ? NO_WARNING_ANGRY : NO_WARNING_DEFAULT);
});

btnYes.addEventListener("click", () => {
  showScreen(screenForm);
});

btnBack.addEventListener("click", () => {
  showScreen(screenWelcome);
});

// ------------------------------------------------------------
// EKRAN 2: FORM
// ------------------------------------------------------------

// "Siz Ekleyin" seçilirse serbest metin alanını göster
otherRadio.addEventListener("change", () => {
  if (otherRadio.checked) {
    customPlace.classList.remove("hidden");
    customPlace.focus();
  }
});

// Başka bir mekan seçilirse serbest metin alanını gizle
document.querySelectorAll('input[name="place"]:not(#other-radio)').forEach(radio => {
  radio.addEventListener("change", () => {
    customPlace.classList.add("hidden");
    customPlace.value = "";
  });
});

// Form gönderimi
detailForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // --- Doğrulama ---
  const purpose = document.querySelector('input[name="purpose"]:checked');
  const placeRadio = document.querySelector('input[name="place"]:checked');

  if (!purpose)  { showToast("Lütfen bir buluşma amacı seçin 📚"); return; }
  if (!placeRadio) { showToast("Lütfen bir mekan seçin ☕"); return; }

  let place = placeRadio.value;
  if (place === "other") {
    place = customPlace.value.trim();
    if (!place) { showToast("Lütfen kendi mekanınızı yazın ✏️"); return; }
  }

  if (!dateInput.value) { showToast("Lütfen bir tarih seçin 🗓️"); return; }
  if (!timeInput.value) { showToast("Lütfen bir saat seçin ⏰"); return; }

  const data = {
    purpose: purpose.value,
    place: place,
    date: formatDate(dateInput.value),
    time: formatTime(timeInput.value),
    notes: notesInput.value.trim() || "—",
    noCount: noCount,
    timestamp: new Date().toLocaleString("tr-TR")
  };

  // Google Sheets'e gönder (arka planda, beklemeden)
  sendToGoogleSheets(data);

  // Sevinç pop-up'ını göster
  openCelebrateModal(data);
});

// ------------------------------------------------------------
// GOOGLE SHEETS BAĞLANTISI
// ------------------------------------------------------------

/**
 * Form verilerini Google Apps Script Web App URL'sine POST eder.
 * CORS kısıtları nedeniyle "no-cors" modu kullanılır; yanıt okunamaz
 * ancak istek Google E-Tablolar'a ulaşır.
 */
function sendToGoogleSheets(data) {
  if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes("BURAYA_")) {
    console.warn("[Google Sheets] URL henüz ayarlanmadı. Veriler gönderilmedi:", data);
    return;
  }

  fetch(GOOGLE_SHEETS_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
    .then(() => console.info("[Google Sheets] Veri gönderildi ✅"))
    .catch(err => console.error("[Google Sheets] Gönderim hatası:", err));
}

// ------------------------------------------------------------
// EKRAN 3: SEVİNÇ POP-UP + SKOR
// ------------------------------------------------------------

function getScoreText() {
  if (noCount === 0) {
    return "Evet/Hayır kısmını hatasız geçtiniz! 🎯";
  }
  if (noCount <= 3) { // 3'ten az basıldıysa
    return "Fena değil! 👍";
  }
  return "Kötü skor! 🙈"; // 3'ten fazla basıldıysa
}

function openCelebrateModal(data) {
  modalScoreText.textContent = getScoreText();
  modalCelebrate.classList.remove("hidden");
}

btnCloseModal.addEventListener("click", () => {
  modalCelebrate.classList.add("hidden");
  showSummary();
});

// ------------------------------------------------------------
// EKRAN 4: ÖZET EKRANI
// ------------------------------------------------------------

function showSummary() {
  const purpose = document.querySelector('input[name="purpose"]:checked')?.value || "—";
  const placeRadio = document.querySelector('input[name="place"]:checked');
  let place = placeRadio?.value || "—";
  if (place === "other") place = customPlace.value.trim() || "—";

  summaryList.innerHTML = `
    <li><span class="key">Buluşma Amacı</span><span class="value">${escapeHtml(purpose)}</span></li>
    <li><span class="key">Mekan</span><span class="value">${escapeHtml(place)}</span></li>
    <li><span class="key">Tarih</span><span class="value">${escapeHtml(formatDate(dateInput.value))}</span></li>
    <li><span class="key">Saat</span><span class="value">${escapeHtml(formatTime(timeInput.value))}</span></li>
    <li><span class="key">Eklemek istedikleriniz</span><span class="value">${escapeHtml(notesInput.value.trim() || "—")}</span></li>
    <li><span class="key">Hayır butonuna basma sayısı</span><span class="value">${noCount} kez ${noCountEmoji()}</span></li>
  `;

  showScreen(screenSummary);
}

function noCountEmoji() {
  if (noCount === 0) return "🎯";
  if (noCount <= 3) return "👍";
  return "🙈";
}

/** Basit HTML kaçış fonksiyonu (güvenlik için). */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
