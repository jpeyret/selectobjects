module.exports = {
  title: 'Select Objects', // Title for the site. This will be displayed in the navbar.
  // theme: '@vuepress/theme-blog',

  head: [
    ['link', { rel: 'icon', href: '/fav.png' }]
  ],


  themeConfig: {
    // Please keep looking down to see the available options.

    logo: "/selectobjects.png",


    nav: [
      {
        text: 'Blog',
        link: '/',
      },
      // {
      //   text: 'Issues',
      //   link: '/issues/',
      // },
      {
        text: 'Tags',
        link: '/tag/',
      },
      {
        text: 'About',
        link: '/about/',
      },

    ],


    directories: [
      {
        id: 'post',
        dirname: '_posts',
        path: '/',
      },

      {
        id: 'issues',
        dirname: '_issues',
        path: '/issues/',
        itemPermalink: '/issues/:slug',
      },


    ],
 
    footer: {
          contact: [
            {
              type: 'github',
              link: 'https://github.com/jpeyret',
            },
          ],
        },



  }

}
