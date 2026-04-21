pipeline {
    agent any

    environment {
        APP_NAME         = 'ci-pipeline-app'
        NEXUS_REGISTRY   = 'http://nexus:8081/repository/npm-hosted/'
        GIT_SHA          = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        PKG_VERSION      = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
        ARTIFACT_VERSION = "${PKG_VERSION}-${GIT_SHA}"
    }

    options {
        timeout(time: 10, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {

        stage('Prepare') {
            steps {
                sh 'rm -f ~/.npmrc .npmrc dist/.npmrc || true'
            }
        }

        stage('Lint') {
            steps {
                echo "Running ESLint..."
                sh 'npm ci'
                sh 'npm run lint'
            }
        }

        stage('Build') {
            steps {
                echo "Building version ${ARTIFACT_VERSION}..."
                sh 'npm run build'
                sh """
                    node -e "const fs=require('fs');const pkg=require('./package.json');pkg.version='${ARTIFACT_VERSION}';fs.writeFileSync('./dist/package.json',JSON.stringify(pkg,null,2));"
                """
            }
        }

        stage('Verify') {
            parallel {
                stage('Test') {
                    steps {
                        echo "Running tests..."
                        sh 'npm test'
                    }
                }
                stage('Security Audit') {
                    steps {
                        echo "Running security audit..."
                        sh 'npm run audit:ci'
                    }
                }
            }
        }

        stage('Archive') {
            steps {
                echo "Archiving artifact..."
                sh """
                    cd dist
                    npm pack
                    mv *.tgz ../${APP_NAME}-${ARTIFACT_VERSION}.tgz
                """
                archiveArtifacts artifacts: "${APP_NAME}-${ARTIFACT_VERSION}.tgz",
                                 fingerprint: true,
                                 onlyIfSuccessful: true
            }
        }

        stage('Publish') {
            steps {
                echo "Publishing to Nexus..."
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-npm-credentials',
                    usernameVariable: 'NEXUS_USER',
                    passwordVariable: 'NEXUS_PASS'
                )]) {
                    sh """
                        AUTH=\$(echo -n "\${NEXUS_USER}:\${NEXUS_PASS}" | base64)
                        echo "registry=${NEXUS_REGISTRY}" > dist/.npmrc
                        echo "_auth=\${AUTH}" >> dist/.npmrc
                        echo "always-auth=true" >> dist/.npmrc
                        cd dist && npm publish --registry ${NEXUS_REGISTRY}
                        rm -f dist/.npmrc
                    """
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline complete."
        }
        success {
            echo "SUCCESS: ${env.APP_NAME}-${env.ARTIFACT_VERSION} published to Nexus."
        }
        failure {
            echo "FAILED: Check the stage above. Nothing was published to Nexus."
        }
        changed {
            echo "STATUS CHANGED: now ${currentBuild.currentResult}."
        }
    }
}