//------------------ Scroll Spy ------------------------//

var scrollSpy = new bootstrap.ScrollSpy(document.body, {
    target: '#nav'
  });


// ----------------Portfolio cards------------------------//

const portfolio = document.querySelector('#portfolioContainer');
let html = '';
let projects = [
  {
    name:'Random Quote Generator',
    image: 'portfolio-1.png',
    link: 'a_random_quote_generator-v1'
  },
  {
    name:'Word Guess',
    image: 'portfolio-2.png',
    link: 'game_show_app_v1.2/'
  },
  {
    name:'Photo Gallery',
    image: 'portfolio-3.png',
    link: 'photo_gallery_v5/'
  },
  {
    name:'Web App',
    image: 'portfolio-5.png',
    link: 'web_app_dashboard_v3.2/'
  },
  {
    name:'Employee Directory',
    image:'portfolio-4.png',
    link:'employee_directory_v1/'

  },
  {
    name:'Sign up Form',
    image:'portfolio-6.png',
    link:'online_registration_v4/'
  }
];

for ( let i = 0; i < projects.length; i++ ) {
  let project = projects[i];
  html += `
  <div class=" col-md-6 col-lg-4 pb-5">
    <div class="card bg-blue ">
        <img class="card-img-top" src="images/${project.image}" alt="${project.name}">
        <div class="card-img-overlay photo-overlay  bg-blue">
            <div class="mt-4 text-white">
                <h2 class=" pb-3 accordion-header text-success" id="headingOne">${project.name}</h2>
                <a href="https://github.com/gerlinp/${project.link}" target="_blank" type="button" class=" btn btn-primary ">Code</a>
                <a href=" https://gerlinp.github.io/${project.link}" target="_blank" type="button" class=" btn btn-success ">Demo</a>
            </div>
        </div>
    </div>
  </div>
  `;
}
portfolio.insertAdjacentHTML('beforeend', html);
// -------------------word rotation-----------------//
var words = (function(){
  var words = [
      'Web Developer',
      'Forever Learner',
      'Foodie',
      'Problem Solver',
      'Geek'
      ],
    el = document.querySelector('.verb'),
    currentIndex,
    currentWord,
    prevWord,
    duration = 4000;

  var _getIndex = function(max, min){
    currentIndex = Math.floor(Math.random() * (max - min + 1)) + min;

    //Generates a random number between beginning and end of words array
    return currentIndex;
  };

  var _getWord = function(index){
    currentWord = words[index];
    return currentWord;
  };

  var _clear = function() {

    setTimeout(function(){
      el.className = 'verb';
    }, duration/4);
  };

  var _toggleWord = function(duration){
    setInterval(function(){
      //Stores value of previous word
      prevWord = currentWord;

      //Generate new current word
      currentWord = words[_getIndex(words.length-1, 0)];

      //Generate new word if prev matches current
      if(prevWord === currentWord){

        currentWord = words[_getIndex(words.length-1, 0)];
      }

      //Swap new value
      el.innerHTML = currentWord;

      //Clear class styles
      _clear();

      //Fade in word
      el.classList.add(
        'js-block',
        'js-fade-in-verb'
        );

    }, duration);
  };

  var _init = function(){
    _toggleWord(duration);
  };

  //Public API
  return {
    init : function(){
      _init();
    }
  };
})();

words.init();
  
