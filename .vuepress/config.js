module.exports = {
    title: 'Select Objects - thinking about Python, databases and PeopleSoft',
    home: true,


    // this ends up on the Home page, under the title.
    description: "SQL beats ORM",


    themeConfig: {
        nav: [
            { text: 'Services', link: '/services/' },
            { text: 'About', link: '/about/' }
        ],

        home: true,

        //turns off the search, might as well until configured.
        search: false,

        logo: '/select-objects-logo-small.png',

        displayAllHeaders: true,

        sidebar: [
            '/',
            '/application_engine/ae_call_ci_p1/',
            '/application_engine/ae_call_ci_p2/',
            '/application_engine/ae_call_ci_p3/'
        ],


        features: [{
            title: "test title1",
            details: "test details 1"
        }]

    },

    plugins: [

        [
            '@vuepress/plugin-blog',
            {
            }
        ]
    ],


}