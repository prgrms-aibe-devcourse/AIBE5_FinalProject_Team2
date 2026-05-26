// src/lib/googleMaps.js
// ✅ 구글맵 스크립트는 앱 전체에서 "딱 1번"만 로드되게 보장

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

let loadingPromise = null;

export function loadGoogleMaps({ libraries = ['places'] } = {}) {
  if (!KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_KEY가 없습니다."));
  }

  // 이미 로드됨
  if (window.google?.maps) return Promise.resolve(window.google);

  // 이미 로딩 중이면 그 Promise 재사용
  if (loadingPromise) return loadingPromise;

  // places 라이브러리를 기본으로 포함
  const allLibraries = [...new Set([...libraries, 'places'])];
  const libParam = allLibraries.length ? `&libraries=${allLibraries.join(",")}` : "";

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.async = true;
    script.defer = true;

    // ✅ 표준 key= 파라미터 사용
    script.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&v=weekly${libParam}`;

    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Google Maps script load failed"));

    document.head.appendChild(script);
  });

  return loadingPromise;
}
