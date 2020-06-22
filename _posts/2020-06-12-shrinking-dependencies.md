---

tags:
    - Python
    - pip
---
# Honey, I shrank the deps

a.k.a. keeping the riff raff on your workstation and out of **requirements.txt**

What got this started was yet another Github security warning about my requirements. 

````
Known security vulnerabilities detected
Dependency bleach 	Version < 3.1.2 	Upgrade to ~> 3.1.2
````

I don't use **bleach**, but eventually found out who does.

````bash
(venv38) myuser@site-packages$ find . -name METADATA -exec grep -H bleach {} \; | grep Requires-Dist
````

output:

````
./readme_renderer-24.0.dist-info/METADATA:Requires-Dist: bleach (>=2.1.0)
````
But that's where it gets complicated.   You see, **readme_renderer** isn't something that my repository actually uses either. Rather it's something that I use to enhance my development environment.  **black, bandit or Sphinx** are in the same category.  Useful, certainly, but not something that I want on a production server.

## So I reorganized my requirements as follows:

### requirements.workstation.txt

Anything there gets installed globally, not in a virtualenv.  I know, I know, not best practices, according to many.

Note: `python3.8` is *not* my system Python, it's a macports install.  I would not recommend adding packages to a system Python.

````
deactivate
#install globally.  You may have to configure pip to work globally to do this.
python3.8 -m pip install bleach black sphinx
````

I really only put things there that I know are not imported by any of my actual code. 

### requirements.dev.txt

Anything that is *exclusively* imported by test scripts.  In my case that includes things like **Beautifulsoup, pytest**. 

### requirements.txt

Anything else.  

Note that you have to be *very* cautious before putting something in **requirements.dev.txt** rather than **requirements.txt**

That's because unittests, being run in a dev context, will not catch something that would be missing in production, but is present in dev.  This concern is by no way specific to my global installation approach, it happens anytime you use a **requirements.dev.txt**.

### creating a dev virtualenv

Here I *do* want to make use of bleach, black, Sphinx, etc.. which is why I am adding the`--system-site-packages` flag.

````
python3.8 -m venv devvenv --system-site-packages
source devvenv/bin/activate
pip install -r requirements.txt -r requirements.dev.txt
````
### virtualenv to test missing dependencies

But what about things that I didn't know I needed after all?  I am going to use my unittests to flag those, in a virtual environment lacking site-packages access.

````
python3.8 -m venv tstvenv
source tstvenv/bin/activate
pip install -r requirements.txt -r requirements.dev.txt
````
Now, anything that's mistakenly installed at a global level should throw an error.

### maintaining requirements files

I don't use `pip freeze` directly but rather run it from time to time, compare previous runs and add my *direct* imports manually to requirements.txt files.  `pip` will happily solve dependencies at run time.  So if say **bleach** gets dropped as an upstream dependency of **readme-renderer** then I won't carry it forward without need.

A secondary benefit is that, having a global **black** install, all I need to do to enable [git commit hooks](https://black.readthedocs.io/en/stable/version_control_integration.html) for it on new repositories is to modify **.git/.pre-commit-config.yaml**.  No need to install it or **pre-commit**.  Same thing with **bandit** and other useful utilities - they are always available.

### Disclaimer

My overriding priority here was to have fewer package dependencies in my repositories, mainly for security and maintenance reasons.  

This works for my particular workflows and processes, and it is supported by a number of custom utility scripts to analyze dependencies.  Will it work for everyone?  Not necessarily.  

Things that could go wrong: 

- I haven't recently repackaged something for pypi upload so I am half expecting **readme_renderer** has something to do with that and will complain.
- GitHub finds vulnerabilities based on your **requirements.txt** files.  However, would it have figured out that **readme_renderer**, at that version, relies on a vulnerable version of **bleach**?  I don't know, so maybe pushing in the whole of freeze output into them is the better idea.

