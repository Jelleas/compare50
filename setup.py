from setuptools import setup, find_packages

setup(
    author="CS50",
    author_email="sysadmins@cs50.harvard.edu",
    classifiers=[
        "Intended Audience :: Education",
        "Programming Language :: Python :: 3.7",
        "Topic :: Education",
        "Topic :: Utilities"
    ],
    license="GPLv3",
    description="This is compare50, with which you can compare files for similarities.",
    install_requires=[
        "attrs>=18,<19.2.0",
        "intervaltree>=3.1.0,<4",
        "lib50>=2,<4",
        "numpy>=1.15,<2",
        "pygments>=2.2,<3",
        "jinja2>=3.1,<4",
        "termcolor>=1.1.0,<2",
        "tqdm>=4.32,<5",
        "pyfarmhash>=0.3.2,<1"
    ],
    extras_require = {
        "develop": ["sphinx", "sphinx_rtd_theme", "sphinx-autobuild", "line_profiler"]
    },
    keywords=["compare", "compare50"],
    name="compare50",
    python_requires=">=3.7",
    packages=find_packages(exclude=["tests"]),
    scripts=["bin/compare50"],
    url="https://github.com/cs50/compare50",
    version="1.3.0",
    include_package_data=True,
)
