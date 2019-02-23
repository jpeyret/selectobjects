module.exports = {
    title: 'Select Objects - thinking about Python, databases and PeopleSoft',
    home: true,


    // this ends up on the Home page, under the title, via $description
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

            {
                title: 'Application Engine', // required
                path: '/application_engine/', // optional, which should be a absolute path.
                collapsable: false, // optional, defaults to true
                sidebarDepth: 2, // optional, defaults to 1
                children: [
                    '/application_engine/ae_call_ci_p1/',
                    '/application_engine/ae_call_ci_p2/',
                    '/application_engine/ae_call_ci_p3/'
                ]
            }

        ],


        sidebar2: [{
                title: 'Group 1', // required
                path: '/foo/', // optional, which should be a absolute path.
                collapsable: false, // optional, defaults to true
                sidebarDepth: 1, // optional, defaults to 1
                children: [
                    '/'
                ]
            },
            {
                title: 'Group 2',
                children: [ /* ... */ ]
            }
        ],


        features: [{
            title: "test title1",
            details: "test details 1"
        }]

    },

    plugins: [

        [
            '@vuepress/plugin-blog',
            {}
        ]
    ],


}