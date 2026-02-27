// Jenkinsfile — Redirects to the split pipelines in ci/.
//
// The actual build and deploy pipelines live in:
//   ci/build.Jenkinsfile  — Kaniko image builds → push to in-cluster registry → trigger deploy
//   ci/deploy.Jenkinsfile — Parameterized Helm upgrade with image tags
//
// Configure two Jenkins pipeline jobs:
//   1. llm-daw-build  → ci/build.Jenkinsfile  (SCM poll / webhook trigger)
//   2. llm-daw-deploy → ci/deploy.Jenkinsfile  (triggered by build, or manual with IMAGE_TAG param)
//
// This file exists only as a pointer. If your Jenkins job points to the repo root,
// update the Script Path to ci/build.Jenkinsfile instead.

// For backwards compat, delegate to the build pipeline:
def REGISTRY = "registry.registry.svc.cluster.local:5000"
def IMAGE_TAG = ""

pipeline {
  agent { label 'kaniko' }

  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
    disableConcurrentBuilds()
  }

  stages {

    stage('Tag') {
      steps {
        script {
          def sha = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true
          ).trim()
          def dirty = sh(
            script: "git status --porcelain 2>/dev/null | wc -l | tr -d ' '",
            returnStdout: true
          ).trim()
          IMAGE_TAG = (dirty != "0") ? "${sha}-dev" : sha
          echo "Image tag: ${IMAGE_TAG}"
          currentBuild.description = "tag=${IMAGE_TAG}"
        }
      }
    }

    stage('Build images') {
      parallel {

        stage('frontend') {
          agent { label 'kaniko' }
          steps {
            container('kaniko') {
              sh """
                /kaniko/executor \\
                  --dockerfile=\${WORKSPACE}/frontend/Dockerfile \\
                  --context=dir://\${WORKSPACE}/frontend \\
                  --destination=${REGISTRY}/llm-daw/frontend:${IMAGE_TAG} \\
                  --destination=${REGISTRY}/llm-daw/frontend:latest \\
                  --insecure \\
                  --insecure-pull \\
                  --skip-tls-verify \\
                  --skip-tls-verify-pull \\
                  --cache=false \\
                  --verbosity=info
              """
            }
          }
        }

        stage('api') {
          agent { label 'kaniko' }
          steps {
            container('kaniko') {
              sh """
                /kaniko/executor \\
                  --dockerfile=\${WORKSPACE}/backend/api/Dockerfile \\
                  --context=dir://\${WORKSPACE}/backend/api \\
                  --destination=${REGISTRY}/llm-daw/api:${IMAGE_TAG} \\
                  --destination=${REGISTRY}/llm-daw/api:latest \\
                  --insecure \\
                  --insecure-pull \\
                  --skip-tls-verify \\
                  --skip-tls-verify-pull \\
                  --cache=false \\
                  --verbosity=info
              """
            }
          }
        }

      }
    }

    stage('Deploy') {
      steps {
        script {
          echo "Triggering llm-daw-deploy with IMAGE_TAG=${IMAGE_TAG}"
          build(
            job: 'llm-daw-deploy',
            parameters: [
              string(name: 'IMAGE_TAG', value: IMAGE_TAG)
            ],
            wait: true,
            propagate: true
          )
        }
      }
    }

  }

  post {
    success {
      echo "Build and deploy complete. Images: ${REGISTRY}/llm-daw/*:${IMAGE_TAG}"
    }
    failure {
      echo "Build failed. Review Kaniko output above for details."
    }
  }
}
