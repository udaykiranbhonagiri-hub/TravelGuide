const destinations = [
  {
    name: "Taj Mahal",
    city: "Agra",
    tag: "World Wonder",
    image: "https://s3.ap-south-1.amazonaws.com/new-assets.ccbp.in/frontend/loading-data/niat-course-projects/Taj_Mahal_%28Edited%29.jpeg",
    blurb: "A white-marble monument and an enduring symbol of love.",
  },
  {
    name: "Red Fort",
    city: "Delhi",
    tag: "Historic Fort",
    image: "https://s3.ap-south-1.amazonaws.com/new-assets.ccbp.in/frontend/loading-data/niat-course-projects/Delhi_fort.jpg",
    blurb: "The imposing red-sandstone heart of Mughal Delhi.",
  },
  {
    name: "Gateway of India",
    city: "Mumbai",
    tag: "Waterfront Icon",
    image: "https://s3.ap-south-1.amazonaws.com/new-assets.ccbp.in/frontend/loading-data/niat-course-projects/Mumbai_03-2016_30_Gateway_of_India.jpg",
    blurb: "Mumbai's graceful gateway to the Arabian Sea.",
  },
  {
    name: "Hawa Mahal",
    city: "Jaipur",
    tag: "Palace of Winds",
    image: "https://s3.ap-south-1.amazonaws.com/new-assets.ccbp.in/frontend/loading-data/niat-course-projects/East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg",
    blurb: "A honeycomb of windows in Jaipur's famous pink city.",
  },
  {
    name: "Golden Temple",
    city: "Amritsar",
    tag: "Spiritual Landmark",
    image: "https://s3.ap-south-1.amazonaws.com/new-assets.ccbp.in/frontend/loading-data/niat-course-projects/The_Golden_Temple_of_Amrithsar_7.jpg",
    blurb: "A radiant sanctuary of peace, service, and devotion.",
  },
  {
    name: "Mysore Palace",
    city: "Mysore",
    tag: "Royal Residence",
    image: "https://s3.ap-south-1.amazonaws.com/new-assets.ccbp.in/frontend/loading-data/niat-course-projects/Mysore_Palace_Morning.jpg",
    blurb: "A dazzling royal palace with ornate Indo-Saracenic detail.",
  },
];

const voices = {
  English: { Male: "Matthew", Female: "Alicia" },
  Hindi: { Male: "Aman", Female: "Namrita" },
  Tamil: { Male: "Murali", Female: "Iniya" },
  Telugu: { Male: "Zion", Female: "Josie" },
};

const locales = { English: "en-US", Hindi: "hi-IN", Tamil: "ta-IN", Telugu: "te-IN" };
const state = { selected: null, length: "Summary", voice: "Male" };

const elements = {
  cards: document.getElementById("destinationCards"),
  empty: document.getElementById("emptyState"),
  search: document.getElementById("searchInput"),
  count: document.getElementById("resultCount"),
  guide: document.getElementById("guidePanel"),
  guideImage: document.getElementById("guideImage"),
  guidePlace: document.getElementById("guidePlace"),
  guideCity: document.getElementById("guideCity"),
  language: document.getElementById("selectLanguage"),
  generate: document.getElementById("generateBtn"),
  status: document.getElementById("generationStatus"),
  result: document.getElementById("guideResult"),
  transcript: document.getElementById("transcriptText"),
  audio: document.getElementById("audioPlayer"),
  audioMessage: document.getElementById("audioMessage"),
  close: document.getElementById("closeGuide"),
};

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function renderDestinations(query = "") {
  const normalizedQuery = query.trim().toLowerCase();
  const matches = destinations.filter((destination) =>
    [destination.name, destination.city, destination.tag].some((value) => value.toLowerCase().includes(normalizedQuery)),
  );

  elements.cards.innerHTML = matches.map((destination) => `
    <article class="destination-card" tabindex="0" role="button" data-name="${escapeHtml(destination.name)}" aria-label="Open guide for ${escapeHtml(destination.name)}">
      <img src="${destination.image}" alt="${escapeHtml(destination.name)}" loading="lazy">
      <div class="card-content">
        <span class="eyebrow">${escapeHtml(destination.tag)}</span>
        <h3>${escapeHtml(destination.name)}</h3>
        <p class="city">${escapeHtml(destination.city)}</p>
        <p>${escapeHtml(destination.blurb)}</p>
        <span class="card-action">Plan your visit <span aria-hidden="true">→</span></span>
      </div>
    </article>
  `).join("");

  elements.empty.hidden = matches.length !== 0;
  elements.count.textContent = normalizedQuery ? `${matches.length} destination${matches.length === 1 ? "" : "s"} found` : "6 curated destinations";
}

function resetResult() {
  elements.result.hidden = true;
  elements.transcript.textContent = "";
  elements.audio.removeAttribute("src");
  elements.audio.load();
  elements.audio.hidden = true;
  elements.audioMessage.hidden = true;
  elements.status.textContent = "";
}

function selectDestination(name) {
  const destination = destinations.find((item) => item.name === name);
  if (!destination) return;
  state.selected = destination;
  elements.guideImage.src = destination.image;
  elements.guideImage.alt = destination.name;
  elements.guidePlace.textContent = destination.name;
  elements.guideCity.textContent = `${destination.city}, India`;
  resetResult();
  elements.guide.hidden = false;
  elements.guide.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.generate.focus({ preventScroll: true });
}

function closeGuide() {
  elements.guide.hidden = true;
  state.selected = null;
  resetResult();
}

function setChoice(group, value) {
  state[group] = value;
  document.querySelectorAll(`[data-choice="${group}"]`).forEach((button) => {
    const selected = button.dataset.value === value;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

async function generateGuide() {
  if (!state.selected) return;
  const language = elements.language.value;
  const body = {
    place: state.selected.name,
    answerType: state.length,
    language,
    voiceId: voices[language][state.voice],
    locale: locales[language],
  };

  resetResult();
  elements.generate.disabled = true;
  elements.generate.innerHTML = '<span class="spinner" aria-hidden="true"></span> Creating your guide…';
  elements.status.textContent = "Writing your personalised guide…";

  try {
    const response = await fetch("/generate-audio-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The guide could not be generated.");

    elements.transcript.textContent = data.description;
    elements.result.hidden = false;
    if (data.audioBase64) {
      elements.audio.src = `data:audio/mpeg;base64,${data.audioBase64}`;
      elements.audio.hidden = false;
      elements.audioMessage.hidden = true;
      elements.status.textContent = "Your audio guide is ready.";
    } else {
      elements.audio.hidden = true;
      elements.audioMessage.hidden = false;
      elements.status.textContent = data.audioError
        ? "Your transcript is ready. Audio is temporarily unavailable."
        : "Your transcript is ready. Add a Murf API key to enable audio.";
    }
  } catch (error) {
    elements.status.textContent = error.message || "Something went wrong. Please try again.";
  } finally {
    elements.generate.disabled = false;
    elements.generate.innerHTML = 'Generate guide <span aria-hidden="true">→</span>';
  }
}

elements.search.addEventListener("input", (event) => renderDestinations(event.target.value));
elements.cards.addEventListener("click", (event) => {
  const card = event.target.closest("[data-name]");
  if (card) selectDestination(card.dataset.name);
});
elements.cards.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-name]");
  if (card) {
    event.preventDefault();
    selectDestination(card.dataset.name);
  }
});
document.querySelectorAll("[data-choice]").forEach((button) => {
  button.addEventListener("click", () => setChoice(button.dataset.choice, button.dataset.value));
});
elements.generate.addEventListener("click", generateGuide);
elements.close.addEventListener("click", closeGuide);

renderDestinations();
