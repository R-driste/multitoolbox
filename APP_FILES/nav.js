document.addEventListener('DOMContentLoaded', () => {
  //INITIAL PAGE
  const button = document.getElementById('startButton');
  if (button) {
    button.addEventListener('click', () => {
      window.location.href = 'first_setup_screen.html';
    });
  } else {
    console.error('startButton not found');
  }

  //PROJECT CREATE STEP
  const button_1 = document.getElementById('firstButton');
  if (button_1) {
    button_1.addEventListener('click', () => {
      window.location.href = 'scopes.html';
    });
  } else {
    console.error('firstButton not found');
  }

  //SCOPES STEP
  const button_2 = document.getElementById('secondButton');
  if (button_2) {
    button_2.addEventListener('click', () => {
      window.location.href = 'credentials.html';
    });
  } else {
    console.error('firstButton not found');
  }

  //CREDENTIALS STEP
  const form = document.getElementById('uploadForm');
  const input = document.getElementById('credInput');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const file = input.files[0];
    if (!file) {
      alert("Please upload a file.");
      return;
    }
    //file uploaded, verify data valid
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const json = JSON.parse(event.target.result);
        console.log("JSON content:", json);
        window.location.href = "keyscreen.html";
      } catch (err) {
        alert("Invalid JSON file, upload proper credentials.");
      }
    };
    reader.onerror = function() {
      alert("Error reading file");
    };
    reader.readAsText(file);
  });
});