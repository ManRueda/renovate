describe('platform/vsts', () => {
  let vsts;
  let gitApi;
  let vstsHelper;
  beforeEach(() => {
    // clean up env
    delete process.env.VSTS_TOKEN;
    delete process.env.VSTS_ENDPOINT;

    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/vsts/vsts-got-wrapper');
    jest.mock('../../../lib/platform/vsts/vsts-helper');
    vsts = require('../../../lib/platform/vsts');
    gitApi = require('../../../lib/platform/vsts/vsts-got-wrapper');
    vstsHelper = require('../../../lib/platform/vsts/vsts-helper');
  });

  function getRepos(token, endpoint) {
    gitApi.mockImplementationOnce(() => ({
      getRepositories: jest.fn(() => [
        {
          name: 'a/b',
        },
        {
          name: 'c/d',
        },
      ]),
    }));
    return vsts.getRepos(token, endpoint);
  }

  describe('getRepos', () => {
    it('should return an array of repos', async () => {
      const repos = await getRepos(
        'sometoken',
        'https://fabrikam.VisualStudio.com/DefaultCollection'
      );
      expect(gitApi.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  function initRepo(...args) {
    gitApi.mockImplementationOnce(() => ({
      getRepositories: jest.fn(() => [
        {
          name: 'some/repo',
          id: '1',
          privateRepo: true,
          isFork: false,
          defaultBranch: 'defBr',
        },
        {
          name: 'c/d',
        },
      ]),
    }));
    gitApi.mockImplementationOnce(() => ({
      getBranch: jest.fn(() => ({ commit: { commitId: '1234' } })),
    }));

    return vsts.initRepo(...args);
  }

  describe('initRepo', () => {
    it(`should initialise the config for a repo`, async () => {
      const config = await initRepo(
        'some/repo',
        'token',
        'https://my.custom.endpoint/'
      );
      expect(gitApi.mock.calls).toMatchSnapshot();
      expect(config).toMatchSnapshot();
    });
  });

  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({
          commit: { commitId: '1234' },
        })),
      }));
      await vsts.setBaseBranch('some-branch');
      expect(gitApi.mock.calls).toMatchSnapshot();
    });
    it('sets the base branch', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({
          commit: { commitId: '1234' },
        })),
      }));
      await vsts.setBaseBranch();
      expect(gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('getCommitMessages()', () => {
    it('returns commits messages', async () => {
      const config = await initRepo(
        'some/repo',
        'token',
        'https://my.custom.endpoint/'
      );
      expect(config.repoId).toBe('1');
      gitApi.mockImplementationOnce(() => ({
        getCommits: jest.fn(() => [
          { comment: 'com1' },
          { comment: 'com2' },
          { comment: 'com3' },
        ]),
      }));
      const msg = await vsts.getCommitMessages();
      expect(msg).toMatchSnapshot();
    });
    it('returns empty array if error', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const msgs = await vsts.getCommitMessages();
      expect(msgs).toEqual([]);
    });
  });

  describe('getFile(filePatch, branchName)', () => {
    it('should return the encoded file content', async () => {
      await initRepo('some/repo', 'token');
      vstsHelper.getFile.mockImplementationOnce(() => `Hello Renovate!`);
      const content = await vsts.getFile('package.json');
      expect(content).toMatchSnapshot();
    });
  });

  describe('findPr(branchName, prTitle, state)', () => {
    it('returns pr if found it open', async () => {
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            status: 2,
          },
        ]),
      }));
      vstsHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      vstsHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        isClosed: false,
      }));
      const res = await vsts.findPr('branch-a', 'branch a pr', 'open');
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found it close', async () => {
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            status: 2,
          },
        ]),
      }));
      vstsHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      vstsHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        isClosed: true,
      }));
      const res = await vsts.findPr('branch-a', 'branch a pr', 'closed');
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found it all state', async () => {
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            status: 2,
          },
        ]),
      }));
      vstsHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      vstsHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        isClosed: true,
      }));
      const res = await vsts.findPr('branch-a', 'branch a pr');
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found it but add an error', async () => {
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            status: 2,
          },
        ]),
      }));
      vstsHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      vstsHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        isClosed: true,
      }));
      const res = await vsts.findPr('branch-a', 'branch a pr', 'blabla');
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const pr = await vsts.findPr('branch-a', 'branch a pr');
      expect(pr).toBeNull();
    });
  });

  describe('getFileList', () => {
    it('returns empty array if error', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const files = await vsts.getFileList();
      expect(files).toEqual([]);
    });
    it('caches the result', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getItems: jest.fn(() => [
          { path: '/symlinks/package.json' },
          { isFolder: false, path: '/package.json' },
          { isFolder: true, path: '/some-dir' },
          { type: 'blob', path: '/src/app/package.json' },
          { type: 'blob', path: '/src/otherapp/package.json' },
        ]),
      }));
      let files = await vsts.getFileList();
      expect(files.length).toBe(4);
      files = await vsts.getFileList();
      expect(files.length).toBe(4);
    });
    it('should return the files matching the fileName', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getItems: jest.fn(() => [
          { path: '/symlinks/package.json' },
          { isFolder: false, path: '/package.json' },
          { isFolder: true, path: '/some-dir' },
          { type: 'blob', path: '/src/app/package.json' },
          { type: 'blob', path: '/src/otherapp/package.json' },
        ]),
      }));
      const files = await vsts.getFileList();
      expect(files).toMatchSnapshot();
    });
  });

  describe('commitFilesToBranch(branchName, files, message, parentBranch)', () => {
    it('should add a new commit to the branch', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        createPush: jest.fn(() => true),
      }));
      vstsHelper.getVSTSBranchObj.mockImplementationOnce(() => 'newBranch');
      vstsHelper.getRefs.mockImplementation(() => [{ objectId: '123' }]);

      const files = [
        {
          name: 'package.json',
          contents: 'hello world',
        },
      ];
      await vsts.commitFilesToBranch(
        'package.json',
        files,
        'my commit message'
      );
      expect(gitApi.mock.calls.length).toBe(3);
    });
    it('should add a new commit to an existing branch', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        createPush: jest.fn(() => true),
      }));
      vstsHelper.getVSTSBranchObj.mockImplementationOnce(() => 'newBranch');
      vstsHelper.getRefs.mockImplementation(() => []);

      const files = [
        {
          name: 'package.json',
          contents: 'hello world',
        },
      ];
      await vsts.commitFilesToBranch(
        'package.json',
        files,
        'my commit message'
      );
      expect(gitApi.mock.calls.length).toBe(3);
    });
  });

  describe('branchExists(branchName)', () => {
    it('should return false if the branch does not exist', async () => {
      await initRepo('some/repo', 'token');
      vstsHelper.getRefs.mockImplementation(() => []);
      const exists = await vsts.branchExists('thebranchname');
      expect(exists).toBe(false);
    });
  });

  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        findPr: jest.fn(() => false),
        getPr: jest.fn(() => {
          'myPRName';
        }),
      }));
      const pr = await vsts.getBranchPr('somebranch');
      expect(pr).toBe(null);
    });
    it('should return the pr', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementation(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            status: 2,
          },
        ]),
      }));
      vstsHelper.getNewBranchName.mockImplementation(
        () => 'refs/heads/branch-a'
      );
      vstsHelper.getRenovatePRFormat.mockImplementation(() => ({
        pullRequestId: 1,
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        isClosed: false,
      }));
      const pr = await vsts.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
    });
  });

  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    it('return success if requiredStatusChecks null', async () => {
      await initRepo('some/repo', 'token');
      const res = await vsts.getBranchStatus('somebranch', null);
      expect(res).toEqual('success');
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      await initRepo('some/repo', 'token');
      const res = await vsts.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual('failed');
    });
    it('should pass through success', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ aheadCount: 0 })),
      }));
      const res = await vsts.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('should pass through failed', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ aheadCount: 123 })),
      }));
      const res = await vsts.getBranchStatus('somebranch', []);
      expect(res).toEqual('pending');
    });
  });

  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await vsts.getPr(null);
      expect(pr).toBe(null);
    });
    it('should return null if no PR is returned from vsts', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => []),
      }));
      const pr = await vsts.getPr(1234);
      expect(pr).toBe(null);
    });
    it('should return a pr in the right format', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [{ pullRequestId: 1234 }]),
      }));
      vstsHelper.getRenovatePRFormat.mockImplementation(() => ({
        pullRequestId: 1234,
      }));
      const pr = await vsts.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
  });

  describe('createPr()', () => {
    it('should create and return a PR object', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        createPullRequest: jest.fn(() => ({
          pullRequestId: 456,
          displayNumber: `Pull Request #456`,
        })),
      }));
      vstsHelper.getRenovatePRFormat.mockImplementation(() => ({
        displayNumber: 'Pull Request #456',
        number: 456,
        pullRequestId: 456,
      }));
      const pr = await vsts.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        ['deps', 'renovate']
      );
      expect(pr).toMatchSnapshot();
    });
    it('should create and return a PR object from base branch', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        createPullRequest: jest.fn(() => ({
          pullRequestId: 456,
          displayNumber: `Pull Request #456`,
        })),
      }));
      vstsHelper.getRenovatePRFormat.mockImplementation(() => ({
        displayNumber: 'Pull Request #456',
        number: 456,
        pullRequestId: 456,
      }));
      const pr = await vsts.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        ['deps', 'renovate'],
        true
      );
      expect(pr).toMatchSnapshot();
    });
  });

  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        updatePullRequest: jest.fn(),
      }));
      await vsts.updatePr(1234, 'The New Title', 'Hello world again');
      expect(gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('ensureComment', () => {
    it('add comment', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementation(() => ({
        createThread: jest.fn(() => [{ id: 123 }]),
      }));
      await vsts.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('isBranchStale', () => {
    it('should return true', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ commit: { commitId: '123456' } })),
      }));
      vstsHelper.getCommitDetails.mockImplementation(() => ({
        parents: ['789654'],
      }));
      const res = await vsts.isBranchStale();
      expect(res).toBe(true);
    });
    it('should return false', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ commit: { commitId: '123457' } })),
      }));
      vstsHelper.getCommitDetails.mockImplementation(() => ({
        parents: ['1234'],
      }));
      const res = await vsts.isBranchStale('branch');
      expect(res).toBe(false);
    });
  });

  describe('getAllRenovateBranches()', () => {
    it('should return all renovate branches', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getBranches: jest.fn(() => [
          { name: 'master' },
          { name: 'renovate/a' },
          { name: 'renovate/b' },
        ]),
      }));
      const res = await vsts.getAllRenovateBranches('renovate/');
      expect(res).toMatchSnapshot();
    });
  });

  describe('ensureCommentRemoval', () => {
    it('deletes comment if found', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementation(() => ({
        getThreads: jest.fn(() => [
          { comments: [{ content: '### some-subject\n\nblabla' }], id: 123 },
        ]),
        updateThread: jest.fn(),
      }));
      await vsts.ensureCommentRemoval(42, 'some-subject');
      expect(gitApi.mock.calls.length).toBe(4);
    });
    it('nothing should happen, no number', async () => {
      await vsts.ensureCommentRemoval();
      expect(gitApi.mock.calls.length).toBe(0);
    });
    it('comment not found', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementation(() => ({
        getThreads: jest.fn(() => [
          { comments: [{ content: 'stupid comment' }], id: 123 },
        ]),
        updateThread: jest.fn(),
      }));
      await vsts.ensureCommentRemoval(42, 'some-subject');
      expect(gitApi.mock.calls.length).toBe(3);
    });
  });

  describe('getBranchLastCommitTime', () => {
    it('should return a Date', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({
          commit: { committer: { date: '1986-11-07T00:00:00Z' } },
        })),
      }));
      const res = await vsts.getBranchLastCommitTime('some-branch');
      expect(res).toMatchSnapshot();
    });
  });

  describe('deleteBranch', () => {
    it('should delete the branch', async () => {
      vstsHelper.getRefs.mockImplementation(() => [{ objectId: '123' }]);
      gitApi.mockImplementationOnce(() => ({
        updateRefs: jest.fn(() => [
          {
            name: 'refs/head/testBranch',
            oldObjectId: '123456',
            newObjectId: '0000000000000000000000000000000000000000',
          },
        ]),
      }));
      const res = await vsts.deleteBranch();
      expect(res).toMatchSnapshot();
    });
  });

  describe('Not supported by VSTS (yet!)', () => {
    it('setBranchStatus', () => {
      const res = vsts.setBranchStatus();
      expect(res).toBeUndefined();
    });

    it('mergeBranch', async () => {
      const res = await vsts.mergeBranch();
      expect(res).toBeUndefined();
    });

    it('mergePr', async () => {
      const res = await vsts.mergePr();
      expect(res).toBeUndefined();
    });

    it('addAssignees', async () => {
      const res = await vsts.addAssignees();
      expect(res).toBeUndefined();
    });

    it('addReviewers', async () => {
      const res = await vsts.addReviewers();
      expect(res).toBeUndefined();
    });

    // to become async?
    it('getPrFiles', () => {
      const res = vsts.getPrFiles(46);
      expect(res.length).toBe(0);
    });
  });
});
