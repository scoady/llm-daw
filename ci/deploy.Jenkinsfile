// ci/deploy.Jenkinsfile
// Parameterized pipeline: runs `helm upgrade` to deploy LLM-DAW with the
// specified image tag from the in-cluster registry.
//
// Triggered automatically by ci/build.Jenkinsfile (with IMAGE_TAG set to the
// just-built git SHA), or manually from the Jenkins UI with any tag.

def REGISTRY = "registry.registry.svc.cluster.local:5000"

pipeline {
  agent { label 'helm' }

  parameters {
    string(
      name: 'IMAGE_TAG',
      defaultValue: 'latest',
      description: 'Image tag to deploy — git SHA (e.g. a1b2c3d) or SHA-dev'
    )
  }

  options {
    timeout(time: 15, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  stages {

    stage('Validate') {
      steps {
        script {
          if (!params.IMAGE_TAG?.trim()) {
            error("IMAGE_TAG parameter is required")
          }
          echo "Deploying LLM-DAW tag=${params.IMAGE_TAG} from registry=${REGISTRY}"
          currentBuild.description = "tag=${params.IMAGE_TAG}"
        }
      }
    }

    // ── Helm upgrade ───────────────────────────────────────────────────────
    stage('Helm upgrade') {
      steps {
        container('helm') {
          sh """
            helm upgrade llm-daw \${WORKSPACE}/infrastructure/helm/llm-daw \\
              --namespace llm-daw \\
              --create-namespace \\
              --values \${WORKSPACE}/infrastructure/helm/llm-daw/values.yaml \\
              --set global.imageRegistry=${REGISTRY} \\
              --set frontend.image.repository=llm-daw/frontend \\
              --set frontend.image.tag=${params.IMAGE_TAG} \\
              --set frontend.image.pullPolicy=Always \\
              --set api.image.repository=llm-daw/api \\
              --set api.image.tag=${params.IMAGE_TAG} \\
              --set api.image.pullPolicy=Always \\
              --wait \\
              --timeout 5m
          """
        }
      }
    }

    stage('Verify rollout') {
      steps {
        container('helm') {
          sh """
            kubectl rollout status deployment/frontend -n llm-daw --timeout=120s
            kubectl rollout status deployment/api       -n llm-daw --timeout=120s
          """
        }
      }
    }

  }

  post {
    success {
      echo "LLM-DAW deployed successfully. Tag: ${params.IMAGE_TAG}"
    }
    failure {
      echo "Deployment failed for tag=${params.IMAGE_TAG}."
      sh "helm history llm-daw -n llm-daw --max 5 || true"
    }
  }
}
