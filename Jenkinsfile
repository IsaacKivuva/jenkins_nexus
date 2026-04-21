pipeline {
    agent {
        docker {
            image 'node:20.14.0-alpine3.19'
            args '--user root'
        }
    }

    environment {
        APP_NAME        = 'ci-pipeline-app'
        NEXUS_REGISTRY  = 'http://nexus:8081/repository/npm-hosted/'
        NEXUS_REALM     = 'nexus'
        GIT_SHA         = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        PKG_VERSION     = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
        ARTIFACT_VERSION = "${PKG_VERSION}-${GIT_SHA}"
    }

    options {
        timeout(time: 10, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {

        stage('Lint') {
            steps {
                echo "Running ESLint on source and test files..."
                sh 'npm ci'
                sh 'npm run lint'
            }
        }

        stage('Build') {
            steps {
                echo "Building application artifact version ${ARTIFACT_VERSION}..."
                sh 'npm run build'
                sh """
                    node -e "
                      const fs = require('fs');
                      const pkg = require('./package.json');
                      pkg.version = '${ARTIFACT_VERSION}';
                      fs.writeFileSync('./dist/package.json', JSON.stringify(pkg, null, 2));
                    "
                """
            }
        }

        stage('Verify') {
            parallel {
                stage('Test') {
                    steps {
                        echo "Running Jest test suite..."
                        sh 'npm test'
                    }
                    post {
                        always {
                            junit testResults: 'coverage/junit.xml', allowEmptyResults: true
                        }
                    }
                }
                stage('Security Audit') {
                    steps {
                        echo "Running npm security audit..."
                        sh 'npm run audit:ci'
                    }
                }
            }
        }

        stage('Archive') {
            steps {
                echo "Packaging artifact ${APP_NAME}-${ARTIFACT_VERSION}.tgz..."
                sh """
                    cd dist
                    npm pack
                    mv *.tgz ../${APP_NAME}-${ARTIFACT_VERSION}.tgz
                """
                fingerprint "${APP_NAME}-${ARTIFACT_VERSION}.tgz"
                archiveArtifacts artifacts: "${APP_NAME}-${ARTIFACT_VERSION}.tgz",
                                 fingerprint: true,
                                 onlyIfSuccessful: true
            }
        }

        stage('Publish') {
            steps {
                echo "Publishing ${ARTIFACT_VERSION} to Nexus registry..."
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-npm-credentials',
                    usernameVariable: 'NEXUS_USER',
                    passwordVariable: 'NEXUS_PASS'
                )]) {
                    sh """
                        AUTH=\$(echo -n "\${NEXUS_USER}:\${NEXUS_PASS}" | base64)
                        echo "registry=${NEXUS_REGISTRY}" > .npmrc
                        echo "_auth=\${AUTH}" >> .npmrc
                        echo "always-auth=true" >> .npmrc

                        cd dist && npm publish --registry ${NEXUS_REGISTRY}

                        rm -f ../.npmrc
                    """
                }
            }
        }
    }

    post {
        always {
            echo "Cleaning up workspace..."
            sh 'rm -f .npmrc'
            cleanWs()
            junit testResults: 'coverage/junit.xml', allowEmptyResults: true
        }
        success {
            echo """
            ============================================
            BUILD SUCCESS
            Artifact : ${env.APP_NAME}-${env.ARTIFACT_VERSION}.tgz
            Registry : ${env.NEXUS_REGISTRY}
            Build    : ${env.BUILD_URL}
            ============================================
            """
        }
        failure {
            echo """
            ============================================
            BUILD FAILED
            Branch   : ${env.GIT_BRANCH}
            Commit   : ${env.GIT_SHA}
            Build    : ${env.BUILD_URL}
            Action   : Review the failed stage above.
                       No artifact was published to Nexus.
            ============================================
            """
        }
        changed {
            echo """
            ============================================
            PIPELINE STATUS CHANGED
            Previous : ${currentBuild.previousBuild?.result ?: 'N/A'}
            Current  : ${currentBuild.currentResult}
            Branch   : ${env.GIT_BRANCH}
            ============================================
            """
        }
    }
}