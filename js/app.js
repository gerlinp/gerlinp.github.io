var scrollSpy = new bootstrap.ScrollSpy(document.body, {
    target: '#navbar-example'
  })
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
  }
]

for ( let i = 0; i < projects.length; i++ ) {
  let project = projects[i];
  html += `
  <div class=" col-md-6 pb-5">
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


/-------------------word rotation-----------------/ 
setInterval(function () {
  const show = document.querySelector('span[data-show]')
  const next = show.nextElementSibling || document.querySelector('span:first-child')
  const up = document.querySelector('span[data-up]')
  
  if (up) {
    up.removeAttribute('data-up')
  }
  
  show.removeAttribute('data-show')
  show.setAttribute('data-up', '')
  
  next.setAttribute('data-show', '')
}, 2000)










  
