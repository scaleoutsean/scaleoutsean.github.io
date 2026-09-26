# Copy files to/from BeeGFS before or after scheduled jobs

We don't necessarily need automated cross-filesystem  tiering

While the ability to move files (or blocks) from and to other filesystems is nice, it isn't always necessary or desirable.

To keep this short, let's say we have the following situation:

- Data ($HOME, etc.) lives on ONTAP NFS or StorageGRID S3
- Some compute jobs must run, or simply run better (faster), on a parallel filesystem
- Some results from parallel jobs need to be saved to users' home directories

To address this we can copy files back and forth. If files or data sets aren't many TBs in size, this shouldn't add much time to compute jobs.

The simplest approach is to manually copy files from A to B.

A better approach is to make that copy operation a job. Something like this (Slurm):

```sh
#SBATCH --partition=beegfs
#SBATCH --account=datamanager
#SBATCH --time=1:00:00
#SBATCH -o slurm-%j.out-%N
#SBATCH -e slurm-%j.err-%N s

setenv WORKSPC /mnt/beegfs/$USER/$SLURM_JOB_ ID
mkdir -p $WORKSPC
cd $WORKSPC
# copy files from NFS to BeeGFS
rsync -a /nfs/sean/project_123/in/*.* .
# the rest of your job
```

Then we can run this as part of our compute job. After job is successfully completed, we can also add a step that copies back the result and deletes the file(s) from BeeGFS.

A variant of this "data mover job" approach is to have separate copy jobs, so that compute jobs run on their own. For example you could start copy jobs after some other job that uploads them to NFS, or at specific time or interval. Some schedulers have own data copy tools, so depending on how suitable those are, it may be advantageous to use built-in tools rather than create custom jobs.

BeeGFS/E-Series users can use (and set) ACLs on BeeGFS to ensure files on BeeGFS are accessible to only them.

If you prefer something else rather than rsync, use something else. As an example, if source and desination involve ONTAP, StorageGRID or BeeGFS/E-Series, it may be better to use XCP, a free data copy utility for NetApp customers that's faster than rsync.

Other alternatives include CloudSync by NetApp (for hybrid cloud scenarios, when one of the ends is in the public cloud), rclone, and more. For interactive use in Jupyter notebooks, you can also consider DataOps Toolkit by NetApp. I blogged about these - find the posts in Archive section.
