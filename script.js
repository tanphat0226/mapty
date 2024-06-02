'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const filterBtn = document.querySelector('.feature__filter-filter');
const resetBtn = document.querySelector('.feature__reset');
const filter = document.querySelector('.filter');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; // min

    // this._setDescription();
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 
    'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// APPLICATION
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleEleventionField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    filterBtn.addEventListener('mousemove', this._showFilterSelect);
    filterBtn.addEventListener('mouseout', this._hideFilterSelect);
    filter.addEventListener('click', this._filterWorkouts.bind(this));
    resetBtn.addEventListener('click', this.reset);
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Render workout markers
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    // Hide form
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _showFilterSelect() {
    filter.style.display = 'block';
  }

  _hideFilterSelect() {
    filter.style.display = 'none';
  }

  _toggleEleventionField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        return alert('Inputs have to the position numbers');
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration, elevation)
      ) {
        return alert('Inputs have to the position numbers');
      }

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    // Add new object to workout
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form +  Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _deleteWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    const deleteBtn = e.target.classList.contains('workout__more-item--delete');

    // If not delete button, return
    if (!deleteBtn) return;

    // Find workout to delete by id
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    // Delete item
    this.#workouts = this.#workouts.filter(work => work.id !== workout.id);

    // Set localStorage again
    this._setLocalStorage();

    // Delete marker
    this._removeWorkoutMarker(workout);

    // Clear existing workouts
    containerWorkouts.innerHTML = '';

    // Render workouts list again
    this.#workouts.forEach(work => this._renderWorkout(work));
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _removeWorkoutMarker(workout) {
    const [lat, lng] = workout.coords;

    // Find marker by lat, lng
    this.#markers.forEach(marker => {
      if (marker._latlng.lat === lat && marker._latlng.lng === lng) {
        marker.remove();
      }
    });
  }

  _renderWorkout(workout) {
    let html = `
    <form class="form hidden">
    <div class="form__row">
      <label class="form__label">Type</label>
      <select class="form__input form__input--type">
        <option value="running">Running</option>
        <option value="cycling">Cycling</option>
      </select>
    </div>
    <div class="form__row">
      <label class="form__label">Distance</label>
      <input class="form__input form__input--distance" placeholder="km" />
    </div>
    <div class="form__row">
      <label class="form__label">Duration</label>
      <input
        class="form__input form__input--duration"
        placeholder="min"
      />
    </div>
    <div class="form__row">
      <label class="form__label">Cadence</label>
      <input
        class="form__input form__input--cadence"
        placeholder="step/min"
      />
    </div>
    <div class="form__row form__row--hidden">
      <label class="form__label">Elev Gain</label>
      <input
        class="form__input form__input--elevation"
        placeholder="meters"
      />
    </div>
    <button class="form__btn">OK</button>
  </form>

      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <button class="workout__more">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
            <path
              class="workout__more-icon"
              d="M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z"
            />
          </svg>

          <ul class="workout__more-list">
            <li class="workout__more-item workout__more-item--edit">
              <svg  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path
                  d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"
                />
              </svg>
              Edit
            </li>
            <li class="workout__more-item workout__more-item--delete">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                <path
                  d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"
                />
              </svg>
              Delete
            </li>
          </ul>
        </button>
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
      `;

    if (workout.type === 'cycling')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
      `;

    containerWorkouts.insertAdjacentHTML('afterbegin', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _filterWorkouts(e) {
    const filterSelect = e.target.closest('.filter__select');

    if (!filterSelect) return;

    // // Clear existing workouts
    containerWorkouts.innerHTML = '';

    let sortedWorkouts;
    if (filterSelect.value === 'distance') {
      sortedWorkouts = [...this.#workouts].sort(
        (a, b) => a.distance - b.distance
      );
    } else if (filterSelect.value === 'time') {
      sortedWorkouts = [...this.#workouts].sort(
        (a, b) => a.duration - b.duration
      );
    }

    sortedWorkouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
