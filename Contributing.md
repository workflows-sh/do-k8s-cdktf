## Contributing Guidelines

This project accepts contributions. In order to contribute, you should pay attention to a few guidelines. Some basic conventions for contributing to this project.


### General 

Please make sure that there aren't existing pull requests attempting to address the issue mentioned. Likewise, please check for issues related to update, as someone else may be working on the issue in a branch or fork.


### Reporting Issues 

Bugs, feature requests, and development-related questions should be directed to our [GitHub issue tracker](https://github.com/workflows-sh/aws-ecs-fargate/issues).


When reporting a bug pr issue, please try to provide as much context as possible such as **operating system**, **CDK version**, **Docker version**, **NVM or NPM version**, **CTO.ai CLI version** and anything else that might be relevant to the bug. For feature requests, please explain what you're trying to do and how the requested feature would help you do that.


## Submitting Modifications 

1. It's generally best to start by opening a new issue describing the bug or feature you're intending to fix. Even if you think it's relatively minor, it's helpful to know what people are working on. Mention in the initial issue that you are planning to work on that bug or feature so that it can be assigned to you.


2. Follow the normal process of [forking](https://docs.github.com/en/get-started/quickstart/fork-a-repo) the project, and setup a new branch to work in. It's important that each group of changes be done in separate branches in order to ensure that a pull request only includes the commits related to that bug or feature.

- Please open a discussion in a new issue / existing issue to talk about the changes you'd like to bring

- Develop in a topic branch, not **main branch**


3. Do your best to have [well-formated commit messages](https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html) for each change. This provides consistency throughout the project and ensures that commit messages are able to be formatted properly by various git tools.


- When creating a new branch, prefix it with the type of the change (see section Commit Message Format below), the associated opened issue number, a dash and some text describing the issue (using dash as a separator).

- For example, if you work on a bugfix for the issue **#156**, you could name the branch `fix156-workflow-deploy`


4. Finally, push the commits to your fork and submit a [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)



## Once you've filed the PR:


- One or more maintainers will use GitHub's review feature to review your PR.
- If the maintainer asks for any changes, edit your changes, push, and ask for another review.
- If the maintainer decides to suggest some improvements or alternatives, modify and make improvements. Once your changes are approved, one of the project maintainers will merge them.


## Licensing 

See the [LICENSE](LICENSE) file for our project's licensing.

