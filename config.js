window.VOTE_CONFIG = {
  // Folder foto di repo GitHub (relatif terhadap index.html)
  photoFolder: "photos",

  // Kosongkan untuk mode lokal (vote hanya tersimpan di browser masing-masing).
  // Isi dengan URL Firebase Realtime Database agar vote dihitung bersama oleh semua pengunjung.
  // Contoh: "https://nama-proyek-default-rtdb.asia-southeast1.firebasedatabase.app"
  firebaseUrl: "",

  // Interval refresh vote (ms) jika memakai Firebase
  pollMs: 10000
};
