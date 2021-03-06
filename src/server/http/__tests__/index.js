import expect from 'expect.js';
import * as kbnTestServer from '../../../../test/utils/kbn_server';
import fromRoot from '../../../utils/from_root';

describe('routes', function () {
  this.slow(10000);
  this.timeout(60000);

  let kbnServer;
  beforeEach(function () {
    kbnServer = kbnTestServer.createServer({
      plugins: {
        scanDirs: [
          fromRoot('src/core_plugins'),
          fromRoot('src/kibi_plugins') // siren: added path to the kibi plugins folder
        ]
      }
    });
    return kbnServer.ready();
  });
  afterEach(function () {
    return kbnServer.close();
  });

  describe('cookie validation', function () {
    it('allows non-strict cookies', function (done) {
      const options = {
        method: 'GET',
        url: '/',
        headers: {
          cookie: 'test:80=value;test_80=value'
        }
      };
      kbnTestServer.makeRequest(kbnServer, options, (res) => {
        expect(res.payload).not.to.contain('Invalid cookie header');
        done();
      });
    });

    it('returns an error if the cookie can\'t be parsed', function (done) {
      const options = {
        method: 'GET',
        url: '/',
        headers: {
          cookie: 'a'
        }
      };
      kbnTestServer.makeRequest(kbnServer, options, (res) =>  {
        expect(res.payload).to.contain('Invalid cookie header');
        done();
      });
    });
  });

  describe('url shortener', () => {
    // kibi: renamed to optionsDiscover
    const optionsDiscover = {
      method: 'POST',
      url: '/shorten',
      payload: {
        url: '/app/kibana#/discover'
      }
    };

    it('generates shortened urls', (done) => {
      kbnTestServer.makeRequest(kbnServer, optionsDiscover, (res) => {
        expect(typeof res.payload).to.be('string');
        expect(res.payload.length > 0).to.be(true);
        done();
      });
    });

    it('redirects shortened urls', (done) => {
      kbnTestServer.makeRequest(kbnServer, optionsDiscover, (res) => {
        const payload = res.payload; // kibi: store payload
        const gotoOptions = {
          method: 'GET',
          url: '/goto/' + res.payload
        };
        kbnTestServer.makeRequest(kbnServer, gotoOptions, (res) => {
          expect(res.statusCode).to.be(302);
          // kibi: verify the redirect according to our implementation
          const actual = res.headers.location;
          try {
            expect(actual).to.be(`/app/kibana#/discover?_h=${payload}`);
          } catch (error) {
            return done(error);
          }
          // kibi: end
          done();
        });
      });
    });

    // kibi: embedding parameters tests
    describe('kibi tests for passing the embedded parameters on', () => {

      describe('discover page', () => {

        it('includes embed parameter in redirect from shortened url', (done) => {
          kbnTestServer.makeRequest(kbnServer, optionsDiscover, (res) => {
            const payload = res.payload;
            const gotoOptions = {
              method: 'GET',
              url: '/goto/' + res.payload + '?embed=true'
            };
            kbnTestServer.makeRequest(kbnServer, gotoOptions, (res) => {
              const actual = res.headers.location;
              try {
                expect(actual).to.be(`/app/kibana#/discover?embed=true&_h=${payload}`);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });

        it('includes kibiNavbarVisible parameters in redirect from shortened url', (done) => {
          kbnTestServer.makeRequest(kbnServer, optionsDiscover, (res) => {
            const payload = res.payload;
            const gotoOptions = {
              method: 'GET',
              url: '/goto/' + res.payload + '?embed=true&kibiNavbarVisible=true'
            };
            kbnTestServer.makeRequest(kbnServer, gotoOptions, (res) => {
              const actual = res.headers.location;
              try {
                expect(actual).to.be(`/app/kibana#/discover?embed=true&kibiNavbarVisible=true&_h=${payload}`);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });
      });

      describe('dashboard page', () => {

        const optionsDashboard = {
          method: 'POST',
          url: '/shorten',
          payload: {
            url: '/app/kibana#/dashboard/dashA'
          }
        };

        it('includes embed parameter in redirect from shortened url', (done) => {
          kbnTestServer.makeRequest(kbnServer, optionsDashboard, (res) => {
            const payload = res.payload;
            const gotoOptions = {
              method: 'GET',
              url: '/goto/' + res.payload + '?embed=true'
            };
            kbnTestServer.makeRequest(kbnServer, gotoOptions, (res) => {
              const actual = res.headers.location;
              try {
                expect(actual).to.be(`/app/kibana#/dashboard?embed=true&_h=${payload}`);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });

        it('includes kibiNavbarVisible parameters in redirect from shortened url', (done) => {
          kbnTestServer.makeRequest(kbnServer, optionsDashboard, (res) => {
            const payload = res.payload;
            const gotoOptions = {
              method: 'GET',
              url: '/goto/' + res.payload + '?embed=true&kibiNavbarVisible=true'
            };
            kbnTestServer.makeRequest(kbnServer, gotoOptions, (res) => {
              const actual = res.headers.location;
              try {
                expect(actual).to.be(`/app/kibana#/dashboard?embed=true&kibiNavbarVisible=true&_h=${payload}`);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });

      });

      describe('visualize page', () => {

        const optionsVisualize = {
          method: 'POST',
          url: '/shorten',
          payload: {
            url: '/app/kibana#/visualize/visA'
          }
        };

        it('includes embed parameter in redirect from shortened url', (done) => {
          kbnTestServer.makeRequest(kbnServer, optionsVisualize, (res) => {
            const payload = res.payload;
            const gotoOptions = {
              method: 'GET',
              url: '/goto/' + res.payload + '?embed=true'
            };
            kbnTestServer.makeRequest(kbnServer, gotoOptions, (res) => {
              const actual = res.headers.location;
              try {
                expect(actual).to.be(`/app/kibana#/visualize?embed=true&_h=${payload}`);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });

        it('includes kibiNavbarVisible parameters in redirect from shortened url', (done) => {
          kbnTestServer.makeRequest(kbnServer, optionsVisualize, (res) => {
            const payload = res.payload;
            const gotoOptions = {
              method: 'GET',
              url: '/goto/' + res.payload + '?embed=true&kibiNavbarVisible=true'
            };
            kbnTestServer.makeRequest(kbnServer, gotoOptions, (res) => {
              const actual = res.headers.location;
              try {
                expect(actual).to.be(`/app/kibana#/visualize?embed=true&kibiNavbarVisible=true&_h=${payload}`);
                done();
              } catch (error) {
                done(error);
              }
            });
          });
        });

      });

    });

    // kibi: end
  });
});
