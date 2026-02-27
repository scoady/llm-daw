// ci/build.Jenkinsfile
// Builds frontend and api images with Kaniko and pushes them to the in-cluster
// Docker registry, then triggers the deploy pipeline.
//
// Each image builds in its own kaniko pod because kaniko mutates the root
// filesystem — sharing a container across builds causes corruption.

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

    // ── Stage 1: Compute image tag ─────────────────────────────────────────
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

    // ── Stage 2: Build and push (2 images) ────────────────────────────────
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

      } // end parallel
    }

    // ── Stage 3: Trigger deploy ────────────────────────────────────────────
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
