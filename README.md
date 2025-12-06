Simple TODO list application for the purpose of demonstrating insecure vs secure coding practices. There will be 2 separate branches involved, of which one is for the insecure version, and the other being secured properly with modern security principles.

This app is built with Node.js, Express, EJS views and SQLite3

Prerequisites: 

    You need:
        Node.js 
        Download from https://nodejs.org 
        run 'npm install' in the terminal, this should install everything required including:

            express – web framework
            ejs – view engine / templates
            body-parser – parse form data / JSON
            sqlite3 – SQLite database driver
            bcrypt – password hashing
            sanitize-html – server-side HTML sanitisation (XSS protection)
            cookie-parser – reads cookies
            csurf – CSRF protection middleware
            helmet – security HTTP headers
            express-session – session management
            @playwright/test – browser automation tests (dev dependency)

        For running the application:

            Clone the repository 
                git clone https://github.com/JoshMcGlynn/secure-todo-app
                cd secure-todo-app

                For insecure branch: 'git checkout insecure'
                And start the server: 'node app.js'

                For secure branch: 'git checkout secure'
                And start the server: 'node app.js'

                Open your browser at http://localhost:3000

        
        For running the testing with Playwright(secure branch only): 
            You must install:
                'npx playwright install'

            Then to run:
                'npx playwright test'

                
        The app uses a local SQLite database file stored under:
            /db/database.sqlite
            
